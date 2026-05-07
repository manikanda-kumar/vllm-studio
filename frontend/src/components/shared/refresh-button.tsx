"use client";

import { RefreshCw } from "lucide-react";

type RefreshButtonProps = {
  onRefresh: () => void;
  loading?: boolean;
  className?: string;
};

export function RefreshButton({ onRefresh, loading = false, className = "" }: RefreshButtonProps) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={loading}
      className={`rounded-lg p-2 transition-colors hover:bg-(--surface) ${className}`}
    >
      <RefreshCw className={`h-4 w-4 text-(--dim) ${loading ? "animate-spin" : ""}`} />
    </button>
  );
}
