"use client";

import { useState } from "react";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

function filenameFromUrl(url: string): string {
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    return path.split("/").pop() || url;
  } catch {
    return url;
  }
}

function isImage(url: string): boolean {
  const lower = url.toLowerCase();
  return IMAGE_EXTENSIONS.some(ext => lower.includes(ext));
}

export default function AttachmentPreview({ links }: { links: string[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (links.length === 0) return <span className="text-gray-300">—</span>;

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {links.map(url => (
          <button key={url} type="button" onClick={() => setPreviewUrl(url)}
            className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-md hover:bg-blue-100 transition truncate max-w-[140px]"
            title={filenameFromUrl(url)}>
            📎 {filenameFromUrl(url)}
          </button>
        ))}
      </div>

      {previewUrl && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="bg-white rounded-2xl max-w-3xl max-h-[85vh] w-full overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <span className="text-sm font-medium text-gray-700 truncate">{filenameFromUrl(previewUrl)}</span>
              <div className="flex items-center gap-3 shrink-0">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[#1a1a2e] hover:underline">
                  Open in new tab ↗
                </a>
                <button onClick={() => setPreviewUrl(null)} aria-label="Close preview" className="text-gray-400 hover:text-gray-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-gray-50 flex items-center justify-center p-2">
              {isImage(previewUrl) ? (
                <img src={previewUrl} alt={filenameFromUrl(previewUrl)} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={previewUrl} title={filenameFromUrl(previewUrl)} className="w-full h-[70vh]" />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
