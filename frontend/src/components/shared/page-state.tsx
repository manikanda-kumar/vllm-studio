"use client";

import { Activity } from "lucide-react";

type PageStateOptions = {
  loading: boolean;
  data: unknown;
  hasData: boolean;
  error?: string | null;
  onLoad: () => void;
};

export function PageState({ loading, data, hasData, error, onLoad }: PageStateOptions) {
  const isInitialLoading = loading && !hasData;

  if (isInitialLoading) {
    return (
      <div className="flex h-full min-h-50 items-center justify-center bg-background">
        <Activity className="h-6 w-6 animate-pulse text-(--dim)" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex h-full min-h-50 items-center justify-center bg-background">
        <div className="mb-0 text-center">
          <p className="mb-4 text-(--err)">{error}</p>
          <button
            type="button"
            onClick={onLoad}
            className="rounded-lg border border-(--border) bg-(--surface) px-4 py-2 text-foreground transition-colors hover:bg-(--surface)"
            title="Retry"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return null;
}
