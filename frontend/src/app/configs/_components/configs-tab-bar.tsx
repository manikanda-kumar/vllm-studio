// CRITICAL
"use client";

import type { ReactNode } from "react";
import { Cable, Blocks, Cpu, Network, Paintbrush, ServerCog } from "lucide-react";
import { useAppStore } from "@/store";

type ConfigTabId = "connection" | "providers" | "engines" | "services" | "system" | "appearance";

const configTabs: Array<{ id: ConfigTabId; label: string; icon: ReactNode; liteMode: boolean }> = [
  { id: "connection", label: "Connection", icon: <Cable className="h-4 w-4" />, liteMode: true },
  { id: "providers", label: "Providers", icon: <Blocks className="h-4 w-4" />, liteMode: true },
  { id: "engines", label: "Engines", icon: <Cpu className="h-4 w-4" />, liteMode: false },
  { id: "services", label: "Services", icon: <Network className="h-4 w-4" />, liteMode: false },
  { id: "system", label: "System", icon: <ServerCog className="h-4 w-4" />, liteMode: false },
  { id: "appearance", label: "Appearance", icon: <Paintbrush className="h-4 w-4" />, liteMode: true },
];

export type { ConfigTabId };

export function ConfigsTabBar({
  activeTab,
  onSelectTab,
}: {
  activeTab: ConfigTabId;
  onSelectTab: (tab: ConfigTabId) => void;
}) {
  const liteMode = useAppStore((s) => s.liteMode);
  const visibleTabs = liteMode ? configTabs.filter((t) => t.liteMode) : configTabs;

  return (
    <div className="mb-6 overflow-x-auto">
      <div className="flex items-center gap-2 min-w-max bg-(--bg) border border-(--border) rounded-lg p-1">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-xs sm:text-sm whitespace-nowrap border ${
                isActive
                  ? "bg-(--hl1)/15 border-(--hl1)/40 text-(--fg)"
                  : "text-(--dim) border-transparent hover:text-(--fg) hover:border-(--border)"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
