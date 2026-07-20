"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeToTransactions, getFormSchemaForClientDashboard, getClientProfile, getDashboardFieldConfig,
} from "@/lib/firestore";
import { effectiveApDates } from "@/lib/apCalendar";
import { canWriteExtraField, canWriteField } from "@/lib/transactionFieldOwnership";
import type { ApCalendar, DashboardType, ExtraFieldDef, FormSchemaField, TransactionRow } from "@/lib/types";
import AttachmentPreview from "./AttachmentPreview";

interface Props {
  clientId: string;
  dashboardType: DashboardType;
}

type Role = "admin" | "client" | "bookkeeper";
type CellKind = "text" | "number" | "date" | "dropdown" | "apDate" | "checkbox" | "attachments";

interface ColumnDef {
  key: string;
  label: string;
  kind: CellKind;
  getValue: (row: TransactionRow) => unknown;
  getEditable: (row: TransactionRow) => boolean;
  options?: string[];
  onCommit: (row: TransactionRow, value: unknown) => void;
}

interface ActiveCell {
  rowId: string;
  colKey: string;
}

const BLANK = "(Blanks)";

function displayValue(col: ColumnDef, row: TransactionRow): string {
  if (col.kind === "checkbox") return col.getValue(row) ? "Checked" : "Unchecked";
  const v = col.getValue(row);
  if (v === undefined || v === null || v === "") return BLANK;
  return String(v);
}

async function writeField(collectionName: "apTransactions" | "arTransactions", txId: string, field: string, value: unknown) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Not authenticated");
  const idToken = await getIdToken(currentUser);
  const res = await fetch("/api/transactions/write-field", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ collectionName, txId, field, value }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to save");
}

function EditableSelect({ value, options, editable, onCommit }: {
  value: string; options: string[]; editable: boolean; onCommit: (v: string) => void;
}) {
  if (!editable) return <span className="text-sm text-gray-700">{value || "—"}</span>;
  return (
    <select value={value} onChange={e => onCommit(e.target.value)}
      className="w-full min-w-[110px] px-1.5 py-1 text-sm bg-transparent focus:outline-none">
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// Local echo so the checkbox flips the instant it's clicked, independent of
// the parent grid's re-render/network round trip — was perceptibly laggy before.
function EditableCheckbox({ value, editable, onCommit }: { value: boolean; editable: boolean; onCommit: (v: boolean) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <input type="checkbox" checked={local} disabled={!editable}
      onChange={e => { const v = e.target.checked; setLocal(v); onCommit(v); }}
      className="w-4 h-4 accent-[#1a1a2e] disabled:opacity-50" />
  );
}

function ColumnFilterPopover({ values, active, onChange, onClose, popoverRef }: {
  values: string[];
  active: Set<string> | undefined;
  onChange: (next: Set<string> | undefined) => void;
  onClose: () => void;
  popoverRef: React.Ref<HTMLDivElement>;
}) {
  const [search, setSearch] = useState("");
  const checked = active ?? new Set(values);
  const visible = values.filter(v => v.toLowerCase().includes(search.toLowerCase()));

  function toggle(v: string) {
    const next = new Set(checked);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next.size === values.length ? undefined : next);
  }

  return (
    <div ref={popoverRef} onClick={e => e.stopPropagation()}
      className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-300 rounded-md shadow-lg z-30 p-2 text-xs normal-case font-normal">
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search values…"
        className="w-full px-2 py-1 mb-2 border border-gray-200 rounded focus:outline-none focus:border-[#1a1a2e]" />
      <div className="flex justify-between mb-2">
        <button type="button" onClick={() => onChange(undefined)} className="text-blue-600 hover:underline">Select all</button>
        <button type="button" onClick={() => onChange(new Set())} className="text-blue-600 hover:underline">Clear</button>
      </div>
      <div className="max-h-48 overflow-auto space-y-0.5">
        {visible.map(v => (
          <label key={v} className="flex items-center gap-2 px-1 py-0.5 rounded hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={checked.has(v)} onChange={() => toggle(v)} className="w-3.5 h-3.5 accent-[#1a1a2e]" />
            <span className="truncate">{v}</span>
          </label>
        ))}
        {visible.length === 0 && <div className="text-gray-400 px-1 py-1">No matches</div>}
      </div>
      <button type="button" onClick={onClose} className="mt-2 w-full px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded">Done</button>
    </div>
  );
}

export default function TransactionGrid({ clientId, dashboardType }: Props) {
  const { profile } = useAuth();
  const role = (profile?.role ?? "client") as Role;
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [schemaFields, setSchemaFields] = useState<FormSchemaField[]>([]);
  const [extraFieldDefs, setExtraFieldDefs] = useState<ExtraFieldDef[]>([]);
  const [apCalendar, setApCalendar] = useState<ApCalendar | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [overrides, setOverrides] = useState<Record<string, Record<string, unknown>>>({});
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [bulkColKey, setBulkColKey] = useState("");
  const [bulkValue, setBulkValue] = useState<unknown>("");

  const suppressBlurRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLTableCellElement>());
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  const collectionName = dashboardType === "payable" ? "apTransactions" : "arTransactions";

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToTransactions(clientId, dashboardType, r => {
      // A live update for a row clears any optimistic override on it — the
      // real data has caught up, no need to keep pretending.
      const liveIds = new Set(r.map(row => row.id));
      setOverrides(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) if (liveIds.has(id)) delete next[id];
        return next;
      });
      setRows(r);
      setLoading(false);
    });
    Promise.all([
      getFormSchemaForClientDashboard(clientId, dashboardType),
      getClientProfile(clientId),
      getDashboardFieldConfig(clientId, dashboardType),
    ]).then(([schema, clientProfile, fieldConfig]) => {
      setSchemaFields((schema?.fields ?? []).filter(f => f.type !== "FileUpload").sort((a, b) => a.order - b.order));
      setApCalendar(clientProfile?.apCalendar);
      setExtraFieldDefs((fieldConfig?.fields ?? []).slice().sort((a, b) => a.order - b.order));
    });
    return unsubscribe;
  }, [clientId, dashboardType]);

  // Close an open filter popover on outside click.
  useEffect(() => {
    if (!openFilterCol) return;
    function handleDocClick(e: MouseEvent) {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) setOpenFilterCol(null);
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [openFilterCol]);

  // Once an edit ends (commit, cancel, or blur), keyboard focus reverts to
  // document.body when the <input> unmounts — reclaim it on the grid
  // container so arrow keys keep navigating cells instead of scrolling the page.
  useEffect(() => {
    if (!editing && activeCell) containerRef.current?.focus({ preventScroll: true });
  }, [editing, activeCell]);

  // Auto-scroll the active cell into view as keyboard navigation moves it.
  useEffect(() => {
    if (!activeCell) return;
    const el = cellRefs.current.get(`${activeCell.rowId}:${activeCell.colKey}`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeCell]);

  const apDateOptions = useMemo(
    () => apCalendar ? effectiveApDates(apCalendar.generatedDates, apCalendar.extraDates, apCalendar.skipDates) : [],
    [apCalendar]
  );

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (b.submittedAt?.toMillis?.() ?? 0) - (a.submittedAt?.toMillis?.() ?? 0)),
    [rows]
  );

  function rowWithOverrides(row: TransactionRow): TransactionRow {
    const rowOverrides = overrides[row.id];
    return rowOverrides ? { ...row, ...rowOverrides } : row;
  }

  const displayRows = useMemo(() => sortedRows.map(rowWithOverrides), [sortedRows, overrides]);

  async function commit(row: TransactionRow, field: string, value: unknown) {
    setOverrides(prev => ({ ...prev, [row.id]: { ...prev[row.id], [field]: value } }));
    try {
      await writeField(collectionName, row.id, field, value);
    } catch (err) {
      // Roll back the optimistic value on failure — surfacing via alert keeps
      // this dependency-free; fine for now, revisit if it feels too blunt in practice.
      setOverrides(prev => {
        const rowOverrides = { ...prev[row.id] };
        delete rowOverrides[field];
        return { ...prev, [row.id]: rowOverrides };
      });
      alert(err instanceof Error ? err.message : "Failed to save change");
    }
  }

  async function commitFormAnswer(row: TransactionRow, questionId: string, value: string) {
    await commit(row, `formAnswers.${questionId}`, value);
  }

  async function commitExtraField(row: TransactionRow, def: ExtraFieldDef, rawValue: unknown) {
    let value: unknown = rawValue;
    if (def.type === "number") value = rawValue === "" ? null : Number(rawValue as string);
    await commit(row, `extraFields.${def.id}`, value);
  }

  const columns = useMemo<ColumnDef[]>(() => {
    const cols: ColumnDef[] = [];
    for (const f of schemaFields) {
      cols.push({
        key: `form:${f.questionId}`,
        label: f.label,
        kind: "text",
        getValue: row => row.formAnswers?.[f.questionId] ?? "",
        getEditable: () => canWriteField(role, `formAnswers.${f.questionId}`),
        onCommit: (row, v) => { void commitFormAnswer(row, f.questionId, String(v)); },
      });
    }
    for (const f of extraFieldDefs) {
      const kind: CellKind =
        f.type === "dropdown" ? "dropdown" :
        f.type === "apDate" ? "apDate" :
        f.type === "checkbox" ? "checkbox" :
        f.type === "number" ? "number" :
        f.type === "date" ? "date" : "text";
      cols.push({
        key: `extra:${f.id}`,
        label: f.label,
        kind,
        getValue: row => row.extraFields?.[f.id],
        getEditable: () => canWriteExtraField(role, f),
        options: f.type === "dropdown" ? (f.options ?? []) : f.type === "apDate" ? apDateOptions : undefined,
        onCommit: (row, v) => { void commitExtraField(row, f, v); },
      });
    }
    cols.push({
      key: "attachments",
      label: "Attachments",
      kind: "attachments",
      getValue: row => row.attachmentLinks ?? [],
      getEditable: () => false,
      onCommit: () => {},
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaFields, extraFieldDefs, apDateOptions, role]);

  const columnValues = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const col of columns) {
      if (col.kind === "attachments") continue;
      const set = new Set<string>();
      for (const row of displayRows) set.add(displayValue(col, row));
      map[col.key] = Array.from(set).sort((a, b) => a.localeCompare(b));
    }
    return map;
  }, [columns, displayRows]);

  const visibleRows = useMemo(
    () => displayRows.filter(row => columns.every(col => {
      if (col.kind === "attachments") return true;
      const f = filters[col.key];
      return !f || f.has(displayValue(col, row));
    })),
    [displayRows, filters, columns]
  );

  const filtersActive = Object.keys(filters).length > 0;

  const bulkEditableColumns = useMemo(
    () => displayRows.length === 0 ? [] : columns.filter(c => c.kind !== "attachments" && c.getEditable(displayRows[0])),
    [columns, displayRows]
  );
  const bulkCol = columns.find(c => c.key === bulkColKey);

  function handleBulkColChange(key: string) {
    setBulkColKey(key);
    const col = columns.find(c => c.key === key);
    setBulkValue(col?.kind === "checkbox" ? false : "");
  }

  const activeRow = activeCell ? visibleRows.find(r => r.id === activeCell.rowId) : undefined;
  const activeCol = activeCell ? columns.find(c => c.key === activeCell.colKey) : undefined;

  function moveActive(dRow: number, dCol: number) {
    if (!activeCell) return;
    const rowIdx = visibleRows.findIndex(r => r.id === activeCell.rowId);
    const colIdx = columns.findIndex(c => c.key === activeCell.colKey);
    if (rowIdx === -1 || colIdx === -1) return;
    const newRowIdx = Math.min(Math.max(rowIdx + dRow, 0), visibleRows.length - 1);
    const newColIdx = Math.min(Math.max(colIdx + dCol, 0), columns.length - 1);
    setActiveCell({ rowId: visibleRows[newRowIdx].id, colKey: columns[newColIdx].key });
    setEditing(false);
  }

  function selectCell(rowId: string, colKey: string) {
    setActiveCell({ rowId, colKey });
  }

  function commitEdit() {
    if (!activeRow || !activeCol) { setEditing(false); return; }
    setEditing(false);
    const original = String(activeCol.getValue(activeRow) ?? "");
    if (editValue !== original) activeCol.onCommit(activeRow, editValue);
  }

  function handleCellClick(row: TransactionRow, col: ColumnDef) {
    const isThisActive = activeCell?.rowId === row.id && activeCell?.colKey === col.key;
    if (isThisActive && editing) return; // let the input handle its own click/cursor placement
    selectCell(row.id, col.key);
    const isTextKind = col.kind === "text" || col.kind === "number" || col.kind === "date";
    if (isTextKind && col.getEditable(row)) {
      setEditValue(String(col.getValue(row) ?? ""));
      setEditing(true);
    } else {
      setEditing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!activeCell || !activeCol || !activeRow) return;
    const isTextKind = activeCol.kind === "text" || activeCol.kind === "number" || activeCol.kind === "date";

    if (editing) {
      if (e.key === "Enter") {
        e.preventDefault();
        suppressBlurRef.current = true;
        commitEdit();
        moveActive(1, 0);
        setTimeout(() => { suppressBlurRef.current = false; }, 0);
      } else if (e.key === "Tab") {
        e.preventDefault();
        suppressBlurRef.current = true;
        commitEdit();
        moveActive(0, e.shiftKey ? -1 : 1);
        setTimeout(() => { suppressBlurRef.current = false; }, 0);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        suppressBlurRef.current = true;
        setEditing(false);
        setTimeout(() => { suppressBlurRef.current = false; }, 0);
      }
      return;
    }

    if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1, 0); }
    else if (e.key === "ArrowDown") { e.preventDefault(); moveActive(1, 0); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveActive(0, -1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); moveActive(0, 1); }
    else if (e.key === "Tab") { e.preventDefault(); moveActive(0, e.shiftKey ? -1 : 1); }
    else if ((e.key === "Enter" || e.key === "F2") && isTextKind && activeCol.getEditable(activeRow)) {
      e.preventDefault();
      setEditValue(String(activeCol.getValue(activeRow) ?? ""));
      setEditing(true);
    } else if ((e.key === " " || e.key === "Enter") && activeCol.kind === "checkbox" && activeCol.getEditable(activeRow)) {
      e.preventDefault();
      activeCol.onCommit(activeRow, !activeCol.getValue(activeRow));
    } else if (isTextKind && activeCol.getEditable(activeRow) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      setEditValue(e.key);
      setEditing(true);
    }
  }

  function applyBulk() {
    if (!bulkCol) return;
    for (const rowId of selectedRowIds) {
      const row = displayRows.find(r => r.id === rowId);
      if (row) bulkCol.onCommit(row, bulkValue);
    }
  }

  function toggleSelectAll() {
    if (visibleRows.length > 0 && visibleRows.every(r => selectedRowIds.has(r.id))) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(visibleRows.map(r => r.id)));
    }
  }

  function cellClassName(isActive: boolean) {
    return [
      "border border-gray-200 px-2 py-1 align-middle text-sm relative",
      isActive ? "z-10 outline outline-2 outline-blue-600 outline-offset-[-2px] bg-blue-50/40" : "",
    ].join(" ");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (displayRows.length === 0) {
    return (
      <div className="bg-white rounded-md border border-gray-300 p-8 text-center text-gray-400">
        No submissions yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-md border border-gray-300 overflow-hidden">
      {selectedRowIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-gray-200 bg-blue-50 text-sm">
          <span className="font-medium text-gray-700">{selectedRowIds.size} selected</span>
          <select value={bulkColKey} onChange={e => handleBulkColChange(e.target.value)}
            className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none">
            <option value="">Choose column…</option>
            {bulkEditableColumns.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          {bulkCol && (
            bulkCol.kind === "checkbox" ? (
              <label className="flex items-center gap-1 text-xs text-gray-700">
                <input type="checkbox" checked={!!bulkValue} onChange={e => setBulkValue(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#1a1a2e]" /> Checked
              </label>
            ) : bulkCol.kind === "dropdown" || bulkCol.kind === "apDate" ? (
              <select value={String(bulkValue ?? "")} onChange={e => setBulkValue(e.target.value)}
                className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none">
                <option value="">—</option>
                {(bulkCol.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input type={bulkCol.kind === "number" ? "number" : bulkCol.kind === "date" ? "date" : "text"}
                value={String(bulkValue ?? "")} onChange={e => setBulkValue(e.target.value)}
                placeholder="Value" className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none" />
            )
          )}
          <button type="button" disabled={!bulkColKey} onClick={applyBulk}
            className="px-3 py-1 text-xs rounded bg-[#1a1a2e] text-white disabled:opacity-40">
            Apply to {selectedRowIds.size} row{selectedRowIds.size === 1 ? "" : "s"}
          </button>
          <button type="button" onClick={() => setSelectedRowIds(new Set())} className="text-xs text-gray-500 hover:underline">
            Clear selection
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        className="overflow-auto max-h-[75vh] focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table className="min-w-full text-left border-collapse">
          <thead className="sticky top-0 bg-gray-100 z-20">
            <tr>
              <th className="border border-gray-200 px-2 py-1.5 w-8 bg-gray-100">
                <input type="checkbox"
                  checked={visibleRows.length > 0 && visibleRows.every(r => selectedRowIds.has(r.id))}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 accent-[#1a1a2e]" />
              </th>
              <th className="border border-gray-200 px-2 py-1.5 w-10 text-xs text-gray-400 bg-gray-100" />
              {columns.map(col => (
                <th key={col.key} className="border border-gray-200 px-2 py-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap bg-gray-100 relative">
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {col.kind !== "attachments" && (
                      <button type="button"
                        onClick={e => { e.stopPropagation(); setOpenFilterCol(openFilterCol === col.key ? null : col.key); }}
                        className={`px-1 rounded normal-case ${filters[col.key] ? "text-blue-600" : "text-gray-400"} hover:text-blue-600`}
                        title="Filter">
                        ▾
                      </button>
                    )}
                  </div>
                  {openFilterCol === col.key && (
                    <ColumnFilterPopover
                      popoverRef={filterPopoverRef}
                      values={columnValues[col.key] ?? []}
                      active={filters[col.key]}
                      onChange={next => setFilters(prev => {
                        const copy = { ...prev };
                        if (next === undefined) delete copy[col.key]; else copy[col.key] = next;
                        return copy;
                      })}
                      onClose={() => setOpenFilterCol(null)}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-3 py-8 text-center text-gray-400 text-sm">
                  No rows match the current filters.{" "}
                  {filtersActive && (
                    <button type="button" onClick={() => setFilters({})} className="text-blue-600 hover:underline">
                      Clear filters
                    </button>
                  )}
                </td>
              </tr>
            ) : visibleRows.map((row, rowIdx) => (
              <tr key={row.id}>
                <td className="border border-gray-200 px-2 py-1 w-8 text-center bg-gray-50">
                  <input type="checkbox" checked={selectedRowIds.has(row.id)}
                    onChange={e => setSelectedRowIds(prev => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(row.id); else next.delete(row.id);
                      return next;
                    })}
                    className="w-3.5 h-3.5 accent-[#1a1a2e]" />
                </td>
                <td className="border border-gray-200 px-2 py-1 w-10 text-xs text-center text-gray-400 bg-gray-50 select-none">
                  {rowIdx + 1}
                </td>
                {columns.map(col => {
                  const isActive = activeCell?.rowId === row.id && activeCell?.colKey === col.key;
                  const editable = col.getEditable(row);
                  return (
                    <td key={col.key}
                      ref={el => { if (el) cellRefs.current.set(`${row.id}:${col.key}`, el); else cellRefs.current.delete(`${row.id}:${col.key}`); }}
                      className={cellClassName(isActive)}
                      onClick={() => handleCellClick(row, col)}>
                      {col.kind === "attachments" ? (
                        <AttachmentPreview links={(row.attachmentLinks ?? [])} />
                      ) : col.kind === "checkbox" ? (
                        <EditableCheckbox value={!!col.getValue(row)} editable={editable}
                          onCommit={v => col.onCommit(row, v)} />
                      ) : col.kind === "dropdown" || col.kind === "apDate" ? (
                        <EditableSelect value={String(col.getValue(row) ?? "")} options={col.options ?? []}
                          editable={editable} onCommit={v => col.onCommit(row, v)} />
                      ) : isActive && editing ? (
                        <input
                          autoFocus
                          type={col.kind === "number" ? "number" : col.kind === "date" ? "date" : "text"}
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onBlur={() => { if (!suppressBlurRef.current) commitEdit(); }}
                          className="w-full min-w-[100px] px-1.5 py-1 text-sm bg-transparent focus:outline-none"
                        />
                      ) : (
                        <span className={editable ? "text-sm text-gray-800" : "text-sm text-gray-400"}>
                          {String(col.getValue(row) ?? "") || "—"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
