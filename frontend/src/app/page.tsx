"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store";
import DashboardPage from "@/components/dashboard/page/dashboard-page";

export default function RootPage() {
  const router = useRouter();
  const liteMode = useAppStore((s) => s.liteMode);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Wait for zustand persist to rehydrate
    const unsub = useAppStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated (e.g. hot reload)
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return unsub;
  }, []);

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
