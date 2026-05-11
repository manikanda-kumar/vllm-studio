"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import DashboardPage from "@/components/dashboard/page/dashboard-page";

export default function RootPage() {
  const router = useRouter();
  const liteMode = useAppStore((s) => s.liteMode);
  // Track zustand-persist rehydration without setState-in-effect: subscribe to
  // onFinishHydration, snapshot hasHydrated(); server snapshot is always false.
  const hydrated = useSyncExternalStore(
    (onChange) => useAppStore.persist.onFinishHydration(onChange),
    () => useAppStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (hydrated && liteMode) {
      router.replace("/agent");
    }
  }, [hydrated, liteMode, router]);

  // Show nothing until hydrated to avoid flash
  if (!hydrated) {
    return null;
  }

  if (liteMode) {
    return null;
  }

  return <DashboardPage />;
}
