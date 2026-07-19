"use client";

import { useEffect, useState } from "react";
import AdminNav from "@/components/AdminNav";
import { getPortalSettings, updatePortalSettings } from "@/lib/firestore";
import { useToast } from "@/context/ToastContext";

export default function SettingsPage() {
  const [services, setServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newService, setNewService] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filloutWebhookBaseUrl, setFilloutWebhookBaseUrl] = useState("");
  const { showToast } = useToast();

  useEffect(() => {
    getPortalSettings().then(s => {
      setServices(s.servicesOptions);
      setFilloutWebhookBaseUrl(s.filloutWebhookBaseUrl ?? "");
      setLoading(false);
    });
  }, []);

  function addService() {
    const trimmed = newService.trim();
    if (!trimmed || services.includes(trimmed)) return;
    setServices(prev => [...prev, trimmed]);
    setNewService("");
  }

  function removeService(s: string) {
    setServices(prev => prev.filter(x => x !== s));
  }

  function moveUp(index: number) {
    if (index === 0) return;
    setServices(prev => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }

  function moveDown(index: number) {
    setServices(prev => {
      if (index === prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updatePortalSettings({ servicesOptions: services, filloutWebhookBaseUrl: filloutWebhookBaseUrl.trim() });
      setSaved(true);
      showToast("Settings saved.", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings.";
      showToast(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AdminNav />
      <main className="flex-1 px-4 sm:px-6 md:px-8 py-6 md:py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Configure portal-wide options</p>
        </div>

        <section className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Services Availed Options</h2>
            <span className="text-xs text-gray-400">{services.length} options</span>
          </div>
          <p className="text-xs text-gray-400 mb-5">These appear as checkboxes when editing a client profile.</p>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-11 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2 mb-5">
              {services.map((s, i) => (
                <div key={s} className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-gray-100 bg-gray-50 group">
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => moveUp(i)} disabled={i === 0}
                      className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button onClick={() => moveDown(i)} disabled={i === services.length - 1}
                      className="p-0.5 text-gray-300 hover:text-gray-600 disabled:opacity-20 transition">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                  <span className="flex-1 text-sm text-gray-700 truncate">{s}</span>
                  <button onClick={() => removeService(s)}
                    className="p-1 text-gray-300 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <input value={newService} onChange={e => setNewService(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addService()}
              placeholder="Add a new service..."
              className="flex-1 px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
            <button onClick={addService} disabled={!newService.trim()}
              className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 disabled:opacity-40 transition">
              Add
            </button>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-100 p-6 mt-5">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-1">Fillout Integration</h2>
          <p className="text-xs text-gray-400 mb-4">
            The deployed <code className="bg-gray-100 px-1 rounded">filloutWebhook</code> Function URL — set this once after deploying,
            then connect individual client forms from each client&apos;s edit page.
          </p>
          <input value={filloutWebhookBaseUrl} onChange={e => setFilloutWebhookBaseUrl(e.target.value)}
            placeholder="https://filloutwebhook-xxxxx-uc.a.run.app"
            className="w-full px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a1a2e] transition" />
        </section>

        <div className="flex justify-end mt-5 pb-8">
          <button onClick={handleSave} disabled={saving || loading}
            className="px-6 py-2.5 bg-[#1a1a2e] text-white text-sm font-medium rounded-lg hover:bg-[#2d2d4e] disabled:opacity-60 transition flex items-center gap-2">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
            ) : saved ? (
              <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Saved!</>
            ) : "Save settings"}
          </button>
        </div>
      </main>
    </div>
  );
}
