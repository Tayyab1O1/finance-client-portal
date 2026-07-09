"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getClientProfile, updateClientProfile, getPortalSettings } from "@/lib/firestore";
import { useToast } from "@/context/ToastContext";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { ClientLink, ClientProfile } from "@/lib/types";
import AdminNav from "@/components/AdminNav";

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
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  useEffect(() => {
    Promise.all([getClientProfile(clientId), getPortalSettings()]).then(([c, settings]) => {
      setServiceOptions(settings.servicesOptions);
      if (!c) return;
      setClient(c);
      setFullName(c.fullName ?? "");
      setExecutiveDirectorName(c.executiveDirectorName ?? "");
      setServicesAvailed(c.servicesAvailed ?? []);
      setClientLinks(c.clientLinks ?? []);
      setLogoPreview(c.logoImageUrl ?? null);
      setCoverPreview(c.coverImageUrl ?? null);
      setLoading(false);
    });
  }, [clientId]);

  function toggleService(s: string) {
    setServicesAvailed(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
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
      const updates: Partial<ClientProfile> = { fullName, executiveDirectorName, servicesAvailed, clientLinks: cleanedLinks };
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
