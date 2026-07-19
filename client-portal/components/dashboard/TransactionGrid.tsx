"use client";

import { useEffect, useMemo, useState } from "react";
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

function EditableText({ value, editable, type = "text", onCommit }: {
  value: string; editable: boolean; type?: "text" | "number" | "date"; onCommit: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  if (!editable) return <span className="text-sm text-gray-700">{value || "—"}</span>;

  return (
    <input type={type} value={local} onChange={e => setLocal(e.target.value)}
      onBlur={() => { if (local !== value) onCommit(local); }}
      className="w-full min-w-[100px] px-2 py-1 text-sm rounded border border-transparent hover:border-gray-200 focus:border-[#1a1a2e] focus:outline-none transition bg-transparent" />
  );
}

function EditableSelect({ value, options, editable, onCommit }: {
  value: string; options: string[]; editable: boolean; onCommit: (v: string) => void;
}) {
  if (!editable) return <span className="text-sm text-gray-700">{value || "—"}</span>;
  return (
    <select value={value} onChange={e => onCommit(e.target.value)}
      className="w-full min-w-[110px] px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#1a1a2e] bg-white">
      <option value="">—</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditableCheckbox({ value, editable, onCommit }: { value: boolean; editable: boolean; onCommit: (v: boolean) => void }) {
  return (
    <input type="checkbox" checked={!!value} disabled={!editable} onChange={e => onCommit(e.target.checked)}
      className="w-4 h-4 accent-[#1a1a2e] disabled:opacity-50" />
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

  async function commitExtraField(row: TransactionRow, def: ExtraFieldDef, rawValue: string | boolean) {
    let value: unknown = rawValue;
    if (def.type === "number") value = rawValue === "" ? null : Number(rawValue);
    await commit(row, `extraFields.${def.id}`, value);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (sortedRows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        No submissions yet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-auto max-h-[75vh]">
      <table className="min-w-full text-left border-collapse">
        <thead className="sticky top-0 bg-gray-50 z-10">
          <tr>
            {schemaFields.map(f => (
              <th key={f.questionId} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">
                {f.label}
              </th>
            ))}
            {extraFieldDefs.map(f => (
              <th key={f.id} className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">
                {f.label}
              </th>
            ))}
            <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap border-b border-gray-100">Attachments</th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(raw => {
            const row = rowWithOverrides(raw);
            return (
              <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                {schemaFields.map(f => (
                  <td key={f.questionId} className="px-3 py-2 align-top">
                    <EditableText
                      value={String(row.formAnswers?.[f.questionId] ?? "")}
                      editable={canWriteField(role, `formAnswers.${f.questionId}`)}
                      onCommit={v => commitFormAnswer(row, f.questionId, v)} />
                  </td>
                ))}
                {extraFieldDefs.map(f => {
                  const editable = canWriteExtraField(role, f);
                  const rawValue = row.extraFields?.[f.id];
                  return (
                    <td key={f.id} className="px-3 py-2 align-top">
                      {f.type === "dropdown" ? (
                        <EditableSelect value={String(rawValue ?? "")} options={f.options ?? []}
                          editable={editable} onCommit={v => commitExtraField(row, f, v)} />
                      ) : f.type === "apDate" ? (
                        <EditableSelect value={String(rawValue ?? "")} options={apDateOptions}
                          editable={editable} onCommit={v => commitExtraField(row, f, v)} />
                      ) : f.type === "checkbox" ? (
                        <EditableCheckbox value={!!rawValue} editable={editable}
                          onCommit={v => commitExtraField(row, f, v)} />
                      ) : (
                        <EditableText
                          value={rawValue != null ? String(rawValue) : ""}
                          type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                          editable={editable} onCommit={v => commitExtraField(row, f, v)} />
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2 align-top">
                  <AttachmentPreview links={row.attachmentLinks ?? []} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
