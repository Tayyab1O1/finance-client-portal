"use client";

import type { ClientLink } from "@/lib/types";

interface Props {
  links: ClientLink[] | undefined;
}

function isSafeUrl(url: string): boolean {
  return /^(https?:\/\/|mailto:)/i.test(url.trim());
}

export default function ClientLinksTable({ links }: Props) {
  if (!links || links.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Links
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="pb-2 pr-4 font-medium">What is this</th>
              <th className="pb-2 font-medium">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {links.map((link) => (
              <tr key={link.id}>
                <td className="py-2.5 pr-4 font-medium text-[#1a1a2e] whitespace-nowrap">
                  {link.label || "—"}
                </td>
                <td className="py-2.5">
                  {isSafeUrl(link.url) ? (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {link.linkText || link.url}
                    </a>
                  ) : (
                    <span className="text-gray-400">{link.linkText || link.url}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
