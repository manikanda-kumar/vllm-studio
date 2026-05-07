"use client";

import type { ReactNode } from "react";

type ConfigRowProps = {
  label: string;
  value: string;
  icon?: ReactNode;
  truncate?: boolean;
  accent?: boolean;
};

export function ConfigRow({
  label,
  value,
  icon,
  truncate = false,
  accent = false,
}: ConfigRowProps) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 shrink-0 items-center gap-2 text-sm text-(--dim)">
        {icon}
        <span>{label}</span>
      </div>
      <span
        className={`flex-1 text-right font-mono text-xs sm:text-sm ${accent ? "text-(--hl2)" : "text-(--fg)"} ${truncate ? "truncate" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
