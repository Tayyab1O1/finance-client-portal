"use client";

import { useState } from "react";
import type { DashboardType } from "@/lib/types";
import TransactionGrid from "./TransactionGrid";

type SubTab = "submissions" | "dashboard";

interface Props {
  clientId: string;
  dashboardType: DashboardType;
}

export default function DashboardPanel({ clientId, dashboardType }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("submissions");

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-gray-100">
        {(["submissions", "dashboard"] as SubTab[]).map(tab => (
          <button key={tab} onClick={() => setSubTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${
              subTab === tab ? "border-[#1a1a2e] text-[#1a1a2e]" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {subTab === "submissions" && <TransactionGrid clientId={clientId} dashboardType={dashboardType} />}
      {subTab === "dashboard" && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          Dashboard view is coming soon.
        </div>
      )}
    </div>
  );
}
