"use client";

import { useState } from "react";
import type { ClientForm } from "@/lib/types";

interface Props {
  forms: ClientForm[];
}

function toEmbedUrl(url: string): string {
  if (!url) return url;
  return url.includes("embedded=true") ? url : `${url}${url.includes("?") ? "&" : "?"}embedded=true`;
}

export default function FormsTab({ forms }: Props) {
  const [activeId, setActiveId] = useState(forms[0]?.id ?? "");
  const activeForm = forms.find(f => f.id === activeId) ?? forms[0];

  if (forms.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        No forms have been added yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <nav className="flex sm:flex-col gap-1 sm:w-56 shrink-0 overflow-x-auto sm:overflow-visible">
        {forms.map(form => (
          <button key={form.id} onClick={() => setActiveId(form.id)}
            className={`text-left px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeForm?.id === form.id
                ? "bg-[#1a1a2e] text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}>
            {form.label || "Untitled form"}
          </button>
        ))}
      </nav>

      <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden min-h-[70vh] flex flex-col">
        {activeForm?.url ? (
          <>
            <div className="flex items-center justify-end px-4 py-2 border-b border-gray-100 shrink-0">
              <a href={activeForm.url} target="_blank" rel="noopener noreferrer"
                className="text-xs font-medium text-gray-500 hover:text-[#1a1a2e] transition inline-flex items-center gap-1">
                Having trouble viewing? Open in a new tab
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
            <iframe key={activeForm.id} src={toEmbedUrl(activeForm.url)} title={activeForm.label}
              className="w-full flex-1" frameBorder={0}>
              Loading form…
            </iframe>
          </>
        ) : (
          <div className="p-8 text-center text-gray-400">This form has no link configured.</div>
        )}
      </div>
    </div>
  );
}
