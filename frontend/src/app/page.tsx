"use client";

import { useSyncExternalStore } from "react";
import { redirect } from "next/navigation";
import { useAppStore } from "@/store";
import DashboardPage from "@/components/dashboard/page/dashboard-page";

export default function RootPage() {
  const liteMode = useAppStore((s) => s.liteMode);
  const hydrated = useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );

  if (!hydrated) return null;
  if (liteMode) redirect("/agent");
  return <DashboardPage />;
}
