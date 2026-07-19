"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getClientProfile, updateClientProfile, getPortalSettings, getFilloutMappingsForClient,
  getDashboardFieldConfig, setDashboardFieldConfig, setClientDashboardEnabled,
} from "@/lib/firestore";
import { useToast } from "@/context/ToastContext";
import { storage, auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type {
  ApCalendar, ClientForm, ClientLink, ClientProfile, DashboardType, ExtraFieldDef, ExtraFieldEditor, ExtraFieldType, FilloutFormMapping,
} from "@/lib/types";
import AdminNav from "@/components/AdminNav";
import { addMonthsIso, effectiveApDates, generateApDates, mergeGeneratedDates, todayIso } from "@/lib/apCalendar";

const FIELD_TYPE_OPTIONS: { value: ExtraFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "apDate", label: "AP Date" },
];

function DropdownOptionsEditor({ options, onChange }: { options: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState("");

  function addOption() {
    const trimmed = input.trim();
    if (!trimmed || options.includes(trimmed)) return;
    onChange([...options, trimmed]);
    setInput("");
  }

  function removeOption(o: string) {
    onChange(options.filter(x => x !== o));
  }

  return (
    <div className="sm:col-span-12 space-y-2 pt-1">
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
          placeholder="Add a dropdown option..."
          className="flex-1 px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
        <button type="button" onClick={addOption} disabled={!input.trim()}
          className="px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 rounded hover:bg-gray-200 disabled:opacity-40 transition">
          + Add option
        </button>
      </div>
      {options.length === 0 ? (
        <p className="text-xs text-gray-400">No options added yet — this dropdown will be empty until you add some.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {options.map(o => (
            <span key={o} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
              {o}
              <button type="button" onClick={() => removeOption(o)} aria-label={`Remove ${o}`} className="text-gray-400 hover:text-red-500">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DashboardFieldsEditor({ clientId, dashboardType }: { clientId: string; dashboardType: DashboardType }) {
  const [fields, setFields] = useState<ExtraFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    getDashboardFieldConfig(clientId, dashboardType).then(config => {
      setFields(config?.fields ?? []);
      setLoading(false);
    });
  }, [clientId, dashboardType]);

  function addField() {
    setFields(prev => [...prev, {
      id: crypto.randomUUID(), label: "", category: "manual", type: "text", editableBy: "bookkeeper", order: prev.length,
    }]);
  }

  function updateField(id: string, patch: Partial<ExtraFieldDef>) {
    setFields(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
  }

  function removeField(id: string) {
    setFields(prev => prev.filter(f => f.id !== id));
  }

  async function save() {
    setSaving(true);
    try {
      const cleaned = fields.map((f, i) => ({ ...f, label: f.label.trim(), order: i }));
      await setDashboardFieldConfig(clientId, dashboardType, cleaned);
      showToast("Fields saved.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to save fields.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="h-16 bg-gray-50 rounded-lg animate-pulse" />;

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-700">Manual &amp; status fields</p>
          <p className="text-xs text-gray-400 mt-0.5">Columns the grid shows besides the form&apos;s own questions — set who fills each one in.</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Add a field with type <strong className="font-medium text-gray-500">AP Date</strong> if you want an AP-run-date column — its options come from
            this client&apos;s AP calendar automatically. <strong className="font-medium text-gray-500">Attachments</strong> always appears as its own
            column regardless (tied to file uploads specifically), so there&apos;s no need to add that one here.
          </p>
        </div>
        <button type="button" onClick={addField} className="text-sm font-medium text-[#1a1a2e] hover:underline shrink-0">
          + Add field
        </button>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-gray-400">No manual or status fields defined yet.</p>
      ) : (
        <div className="space-y-2">
          {fields.map(f => (
            <div key={f.id} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center border border-gray-100 rounded-lg p-2.5">
              <input value={f.label} onChange={e => updateField(f.id, { label: e.target.value })}
                placeholder="Field label" className="col-span-2 sm:col-span-3 px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#1a1a2e]" />
              <select value={f.category} onChange={e => updateField(f.id, { category: e.target.value as ExtraFieldDef["category"] })}
                className="col-span-1 sm:col-span-3 px-2 py-1.5 text-sm rounded border border-gray-200 bg-white">
                <option value="manual">Manual</option>
                <option value="status">Status</option>
              </select>
              <select value={f.type} onChange={e => updateField(f.id, { type: e.target.value as ExtraFieldType })}
                className="col-span-1 sm:col-span-3 px-2 py-1.5 text-sm rounded border border-gray-200 bg-white">
                {FIELD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select value={f.editableBy} onChange={e => updateField(f.id, { editableBy: e.target.value as ExtraFieldEditor })}
                className="col-span-1 sm:col-span-2 min-w-[92px] px-2 py-1.5 text-sm rounded border border-gray-200 bg-white">
                <option value="client">Client</option>
                <option value="bookkeeper">Staff</option>
              </select>
              <button type="button" onClick={() => removeField(f.id)} aria-label="Remove field"
                className="col-span-1 sm:col-span-1 flex justify-center text-gray-400 hover:text-red-500">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {f.type === "dropdown" && (
                <DropdownOptionsEditor options={f.options ?? []} onChange={next => updateField(f.id, { options: next })} />
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" onClick={save} disabled={saving}
        className="px-4 py-2 bg-[#1a1a2e] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d4e] disabled:opacity-60 transition">
        {saving ? "Saving..." : "Save fields"}
      </button>
    </div>
  );
}

const EMPTY_AP_CALENDAR: ApCalendar = {
  startDate: "", recurrence: "biweekly", skipDates: [], extraDates: [], generatedDates: [],
};

function ApCalendarEditor({ value, onChange }: { value: ApCalendar; onChange: (next: ApCalendar) => void }) {
  const [extraDateInput, setExtraDateInput] = useState("");
  const dates = effectiveApDates(value.generatedDates, value.extraDates, value.skipDates);

  function generateOrExtend() {
    if (!value.startDate) return;
    const through = addMonthsIso(value.startDate > todayIso() ? value.startDate : todayIso(), 12);
    const generated = generateApDates(value.startDate, value.recurrence, through, value.skipDates);
    onChange({ ...value, generatedDates: mergeGeneratedDates(value.generatedDates, generated) });
  }

  function removeDate(date: string) {
    onChange({
      ...value,
      generatedDates: value.generatedDates.filter(d => d !== date),
      extraDates: value.extraDates.filter(d => d !== date),
      skipDates: value.generatedDates.includes(date) ? [...value.skipDates, date] : value.skipDates,
    });
  }

  function addExtraDate() {
    if (!extraDateInput) return;
    if (!dates.includes(extraDateInput)) {
      onChange({ ...value, extraDates: [...value.extraDates, extraDateInput] });
    }
    setExtraDateInput("");
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Start date</label>
          <input type="date" value={value.startDate} onChange={e => onChange({ ...value, startDate: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Recurrence</label>
          <select value={value.recurrence} onChange={e => onChange({ ...value, recurrence: e.target.value as ApCalendar["recurrence"] })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <div className="flex items-end">
          <button type="button" onClick={generateOrExtend} disabled={!value.startDate}
            className="w-full px-3 py-2 bg-[#1a1a2e] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d4e] disabled:opacity-40 transition">
            Generate / extend 12 months
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">
        Extending never removes a date already generated — even if you change the recurrence later, existing dates stay valid for any transaction already assigned to them.
      </p>

      <div className="flex gap-2">
        <input type="date" value={extraDateInput} onChange={e => setExtraDateInput(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
        <button type="button" onClick={addExtraDate} disabled={!extraDateInput}
          className="px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition">
          + Add one-off date
        </button>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{dates.length} run dates</p>
        {dates.length === 0 ? (
          <p className="text-sm text-gray-400">No dates generated yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {dates.map(d => (
              <span key={d} className="inline-flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                {d}
                <button type="button" onClick={() => removeDate(d)} aria-label={`Remove ${d}`} className="text-gray-400 hover:text-red-500">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DASHBOARD_LABELS: Record<DashboardType, string> = {
  payable: "Accounts Payable / Expense",
  receivable: "Receivables",
};

function DashboardConnector({ clientId, dashboardType, enabled, onToggle, mapping, onMappingChange }: {
  clientId: string;
  dashboardType: DashboardType;
  enabled: boolean;
  onToggle: () => void;
  mapping: FilloutFormMapping | undefined;
  onMappingChange: (mapping: FilloutFormMapping | null) => void;
}) {
  const [filloutFormId, setFilloutFormId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  async function authedFetch(url: string, body: unknown) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("Not authenticated");
    const idToken = await getIdToken(currentUser);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function connect() {
    if (!filloutFormId.trim() || !label.trim()) {
      showToast("Enter both a Fillout form ID and a label.");
      return;
    }
    setBusy(true);
    try {
      await authedFetch("/api/admin/fillout/connect-form", {
        clientId, dashboardType, filloutFormId: filloutFormId.trim(), label: label.trim(),
      });
      onMappingChange({
        filloutFormId: filloutFormId.trim(), clientId, dashboardType, label: label.trim(),
        webhookId: "", createdAt: null as unknown as FilloutFormMapping["createdAt"],
      });
      setFilloutFormId(""); setLabel("");
      showToast("Fillout form connected.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to connect form.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!mapping) return;
    setBusy(true);
    try {
      await authedFetch("/api/admin/fillout/disconnect-form", { filloutFormId: mapping.filloutFormId });
      onMappingChange(null);
      showToast("Fillout form disconnected.", "success");
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to disconnect form.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-gray-100 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-700">{DASHBOARD_LABELS[dashboardType]}</span>
        <button type="button" onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition shrink-0 ${enabled ? "bg-[#1a1a2e]" : "bg-gray-200"}`}
          aria-pressed={enabled} aria-label={`Enable ${DASHBOARD_LABELS[dashboardType]} dashboard`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`} />
        </button>
      </div>

      {enabled && (
        mapping ? (
          <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-100 rounded-lg px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-800 truncate">{mapping.label}</p>
              <p className="text-xs text-green-600 truncate">Connected — form {mapping.filloutFormId}</p>
            </div>
            <button type="button" onClick={disconnect} disabled={busy}
              className="text-xs font-medium px-3 py-1.5 bg-white text-red-600 border border-red-100 rounded-lg hover:bg-red-50 disabled:opacity-60 transition shrink-0">
              {busy ? "..." : "Disconnect"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (e.g. Expense Form)"
              className="sm:col-span-4 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
            <input value={filloutFormId} onChange={e => setFilloutFormId(e.target.value)} placeholder="Fillout form ID"
              className="sm:col-span-5 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
            <button type="button" onClick={connect} disabled={busy}
              className="sm:col-span-3 px-3 py-2 bg-[#1a1a2e] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d4e] disabled:opacity-60 transition">
              {busy ? "Connecting..." : "Connect"}
            </button>
          </div>
        )
      )}
    </div>
  );
}

export default function EditClientPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [client, setClient] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { showToast } = useToast();

  const [serviceOptions, setServiceOptions] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [executiveDirectorName, setExecutiveDirectorName] = useState("");
  const [servicesAvailed, setServicesAvailed] = useState<string[]>([]);
  const [clientLinks, setClientLinks] = useState<ClientLink[]>([]);
  const [formsEnabled, setFormsEnabled] = useState(false);
  const [forms, setForms] = useState<ClientForm[]>([]);
  const [dashboardsEnabled, setDashboardsEnabled] = useState<Partial<Record<DashboardType, boolean>>>({});
  const [filloutMappings, setFilloutMappings] = useState<FilloutFormMapping[]>([]);
  const [apCalendar, setApCalendar] = useState<ApCalendar>(EMPTY_AP_CALENDAR);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    Promise.all([getClientProfile(clientId), getPortalSettings(), getFilloutMappingsForClient(clientId)]).then(([c, settings, mappings]) => {
      setServiceOptions(settings.servicesOptions);
      setFilloutMappings(mappings);
      if (!c) return;
      setClient(c);
      setFullName(c.fullName ?? "");
      setExecutiveDirectorName(c.executiveDirectorName ?? "");
      setServicesAvailed(c.servicesAvailed ?? []);
      setClientLinks(c.clientLinks ?? []);
      setFormsEnabled(c.formsEnabled ?? false);
      setForms(c.forms ?? []);
      setDashboardsEnabled(c.dashboardsEnabled ?? {});
      setApCalendar(c.apCalendar ?? EMPTY_AP_CALENDAR);
      setLogoPreview(c.logoImageUrl ?? null);
      setCoverPreview(c.coverImageUrl ?? null);
      setLoading(false);
    });
  }, [clientId]);

  function toggleService(s: string) {
    setServicesAvailed(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  // Persists immediately rather than waiting for the page's batched "Save
  // changes" button — connecting/disconnecting a Fillout form is itself an
  // immediate action, so leaving "enabled" as deferred-save state made it easy
  // to connect a form, forget to hit Save, and end up with a connected
  // dashboard that's silently still disabled.
  async function toggleDashboardEnabled(type: DashboardType) {
    const next = !(dashboardsEnabled[type] ?? false);
    setDashboardsEnabled(prev => ({ ...prev, [type]: next }));
    try {
      await setClientDashboardEnabled(clientId, type, next);
    } catch (err: unknown) {
      setDashboardsEnabled(prev => ({ ...prev, [type]: !next }));
      showToast(err instanceof Error ? err.message : "Failed to update dashboard status.");
    }
  }

  function addLink() {
    setClientLinks(prev => [...prev, { id: crypto.randomUUID(), label: "", linkText: "", url: "" }]);
  }

  function updateLink(id: string, field: keyof Omit<ClientLink, "id">, value: string) {
    setClientLinks(prev => prev.map(link => link.id === id ? { ...link, [field]: value } : link));
  }

  function removeLink(id: string) {
    setClientLinks(prev => prev.filter(link => link.id !== id));
  }

  function addForm() {
    setForms(prev => [...prev, { id: crypto.randomUUID(), label: "", url: "" }]);
  }

  function updateForm(id: string, field: keyof Omit<ClientForm, "id">, value: string) {
    setForms(prev => prev.map(form => form.id === id ? { ...form, [field]: value } : form));
  }

  function removeForm(id: string) {
    setForms(prev => prev.filter(form => form.id !== id));
  }

  function normalizeUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    return /^(https?:\/\/|mailto:)/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  }

  async function uploadImage(file: File, path: string): Promise<string> {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const cleanedLinks = clientLinks
        .filter(link => link.label.trim() || link.url.trim())
        .map(link => ({ ...link, url: normalizeUrl(link.url), label: link.label.trim(), linkText: link.linkText.trim() }));
      const cleanedForms = forms
        .filter(form => form.label.trim() || form.url.trim())
        .map(form => ({ ...form, url: normalizeUrl(form.url), label: form.label.trim() }));
      const updates: Partial<ClientProfile> = {
        fullName, executiveDirectorName, servicesAvailed, clientLinks: cleanedLinks,
        formsEnabled, forms: cleanedForms, dashboardsEnabled, apCalendar,
      };
      if (logoFile) updates.logoImageUrl = await uploadImage(logoFile, `clients/${clientId}/logo`);
      if (coverFile) updates.coverImageUrl = await uploadImage(coverFile, `clients/${clientId}/cover`);
      await updateClientProfile(clientId, updates);
      setSaved(true);
      showToast("Profile saved successfully.", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save profile.";
      showToast(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a1a2e] border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const displayName = client?.fullName || client?.clickupFolderName || clientId;

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-3xl">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6 min-w-0">
          <Link href="/admin" className="hover:text-[#1a1a2e] transition shrink-0">Dashboard</Link>
          <span className="shrink-0">/</span>
          <span className="text-[#1a1a2e] font-medium truncate">{displayName}</span>
          <span className="shrink-0">/</span>
          <span className="text-[#1a1a2e] shrink-0">Edit</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Edit Client Profile</h1>
          <div className="flex gap-2">
            <Link href={`/admin/clients/${clientId}/users`}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              Manage Users
            </Link>
            <Link href={`/admin/clients/${clientId}`}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
              View Portal
            </Link>
          </div>
        </div>

        <div className="space-y-5">
          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Basic Information</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Client Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition"
                placeholder={client?.clickupFolderName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Executive Director Name</label>
              <input value={executiveDirectorName} onChange={e => setExecutiveDirectorName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition"
                placeholder="Full name" />
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Images</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Client Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </div>
                <div>
                  <button onClick={() => logoFileRef.current?.click()}
                    className="text-sm font-medium text-[#1a1a2e] hover:underline">
                    {logoPreview ? "Change logo" : "Upload logo"}
                  </button>
                  <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 2MB.</p>
                  <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Cover Image</label>
              <div className="w-full h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 overflow-hidden relative cursor-pointer"
                onClick={() => coverFileRef.current?.click()}>
                {coverPreview ? (
                  <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs text-gray-400">Click to upload cover image</p>
                  </div>
                )}
                <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">Services Availed</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {serviceOptions.map(s => (
                <button key={s} type="button" onClick={() => toggleService(s)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition text-left w-full ${
                    servicesAvailed.includes(s) ? "border-[#1a1a2e] bg-[#1a1a2e]/5" : "border-gray-100 hover:border-gray-200"
                  }`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${
                    servicesAvailed.includes(s) ? "bg-[#1a1a2e] border-[#1a1a2e]" : "border-gray-300"
                  }`}>
                    {servicesAvailed.includes(s) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{s}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Links</h2>
              <button type="button" onClick={addLink}
                className="text-sm font-medium text-[#1a1a2e] hover:underline">
                + Add link
              </button>
            </div>

            {clientLinks.length === 0 ? (
              <p className="text-sm text-gray-400">No links added yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  <span className="col-span-3">What is this</span>
                  <span className="col-span-3">Hyperlink text</span>
                  <span className="col-span-5">Link</span>
                </div>
                {clientLinks.map(link => (
                  <div key={link.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center border border-gray-100 sm:border-0 rounded-lg p-3 sm:p-0">
                    <div className="sm:col-span-3">
                      <label className="sm:hidden block text-xs text-gray-400 mb-1">What is this link</label>
                      <input value={link.label} onChange={e => updateLink(link.id, "label", e.target.value)}
                        placeholder="What is this link"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="sm:hidden block text-xs text-gray-400 mb-1">Hyperlink text</label>
                      <input value={link.linkText} onChange={e => updateLink(link.id, "linkText", e.target.value)}
                        placeholder="Hyperlink text"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
                    </div>
                    <div className="sm:col-span-4">
                      <label className="sm:hidden block text-xs text-gray-400 mb-1">Link</label>
                      <input value={link.url} onChange={e => updateLink(link.id, "url", e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
                    </div>
                    <div className="sm:col-span-1 flex sm:justify-center justify-end">
                      <button type="button" onClick={() => removeLink(link.id)} aria-label="Remove link"
                        className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition p-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="sm:hidden text-xs">Remove link</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Forms</h2>
                <p className="text-xs text-gray-400 mt-0.5">Google Forms shown to this client in a dedicated portal tab.</p>
              </div>
              <button type="button" onClick={() => setFormsEnabled(prev => !prev)}
                className={`relative w-11 h-6 rounded-full transition shrink-0 ${formsEnabled ? "bg-[#1a1a2e]" : "bg-gray-200"}`}
                aria-pressed={formsEnabled} aria-label="Enable forms tab">
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  formsEnabled ? "translate-x-5" : "translate-x-0"
                }`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Form list</span>
              <button type="button" onClick={addForm}
                className="text-sm font-medium text-[#1a1a2e] hover:underline">
                + Add form
              </button>
            </div>

            {forms.length === 0 ? (
              <p className="text-sm text-gray-400">No forms added yet.</p>
            ) : (
              <div className="space-y-3">
                <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  <span className="col-span-4">Form name</span>
                  <span className="col-span-7">Google Form link</span>
                </div>
                {forms.map(form => (
                  <div key={form.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center border border-gray-100 sm:border-0 rounded-lg p-3 sm:p-0">
                    <div className="sm:col-span-4">
                      <label className="sm:hidden block text-xs text-gray-400 mb-1">Form name</label>
                      <input value={form.label} onChange={e => updateForm(form.id, "label", e.target.value)}
                        placeholder="e.g. Expense Form"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
                    </div>
                    <div className="sm:col-span-7">
                      <label className="sm:hidden block text-xs text-gray-400 mb-1">Google Form link</label>
                      <input value={form.url} onChange={e => updateForm(form.id, "url", e.target.value)}
                        placeholder="https://docs.google.com/forms/d/e/.../viewform"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
                    </div>
                    <div className="sm:col-span-1 flex sm:justify-center justify-end">
                      <button type="button" onClick={() => removeForm(form.id)} aria-label="Remove form"
                        className="flex items-center gap-1.5 text-gray-400 hover:text-red-500 transition p-1.5">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span className="sm:hidden text-xs">Remove form</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">AP/AR Dashboards</h2>
              <p className="text-xs text-gray-400 mt-0.5">Connect each dashboard to the Fillout form that feeds it.</p>
            </div>
            {(["payable", "receivable"] as DashboardType[]).map(type => (
              <div key={type} className="space-y-3">
                <DashboardConnector clientId={clientId} dashboardType={type}
                  enabled={dashboardsEnabled[type] ?? false}
                  onToggle={() => toggleDashboardEnabled(type)}
                  mapping={filloutMappings.find(m => m.dashboardType === type)}
                  onMappingChange={(m) => setFilloutMappings(prev => {
                    const withoutType = prev.filter(x => x.dashboardType !== type);
                    return m ? [...withoutType, m] : withoutType;
                  })} />
                {(dashboardsEnabled[type] ?? false) && <DashboardFieldsEditor clientId={clientId} dashboardType={type} />}
              </div>
            ))}
          </section>

          <section className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">AP Calendar</h2>
              <p className="text-xs text-gray-400 mt-0.5">Recurring run dates offered in the AP-date dropdown on this client&apos;s transactions.</p>
            </div>
            <ApCalendarEditor value={apCalendar} onChange={setApCalendar} />
          </section>

          <div className="flex items-center justify-between pt-2 pb-8">
            <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a1a2e] transition">← Back to dashboard</Link>
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-[#1a1a2e] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d4e] disabled:opacity-60 transition flex items-center gap-2">
              {saving ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
              ) : saved ? (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved!</>
              ) : "Save changes"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
