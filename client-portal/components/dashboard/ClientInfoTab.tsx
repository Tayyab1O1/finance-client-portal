"use client";

import type { ClientProfile } from "@/lib/types";
import ClientLinksTable from "./ClientLinksTable";

interface Props {
  profile: ClientProfile | null;
}

const SERVICE_COLORS: Record<string, string> = {
  default: "bg-blue-50 text-blue-700 border-blue-100",
};

function ServiceBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-[#1a1a2e]/8 text-[#1a1a2e] border border-[#1a1a2e]/10">
      {name}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm font-medium text-[#1a1a2e]">{value || "—"}</dd>
    </div>
  );
}

export default function ClientInfoTab({ profile }: Props) {
  if (!profile) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
        No client profile found. Please contact your administrator.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main info card */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
          Account Details
        </h2>
        <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
          <InfoRow label="Client Name" value={profile.fullName || profile.clickupFolderName} />
          <InfoRow label="Executive Director" value={profile.executiveDirectorName} />
          <InfoRow label="Client Code" value={profile.clickupFolderName} />
        </dl>
      </div>

      {/* Services card */}
      {profile.servicesAvailed && profile.servicesAvailed.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Services Availed
          </h2>
          <div className="flex flex-wrap gap-2">
            {profile.servicesAvailed.map((service) => (
              <ServiceBadge key={service} name={service} />
            ))}
          </div>
        </div>
      )}

      <ClientLinksTable links={profile.clientLinks} />

      {/* Sync status */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <p className="text-xs text-gray-400">
          Last synced from ClickUp:{" "}
          <span className="text-gray-600">
            {profile.syncedAt
              ? new Date(profile.syncedAt.toMillis()).toLocaleString()
              : "Never"}
          </span>
        </p>
      </div>
    </div>
  );
}
