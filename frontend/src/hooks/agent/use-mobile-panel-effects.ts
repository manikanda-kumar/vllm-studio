import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type HealthPayload = {
  nodeVersion: string;
  nodeVersionOk: boolean;
  npxFound: boolean;
  mobileMcpLaunchOk: boolean;
  mobileMcpVersion: string | null;
  adbFound: boolean;
  xcrunFound: boolean;
  serveSimFound: boolean;
  platform: "darwin" | "linux" | "win32";
  supportedFeatures: {
    devices: boolean;
    screenshot: boolean;
    tap: boolean;
    button: boolean;
    boot: boolean;
    logs: boolean;
    stream: boolean;
  };
};

type UseMobilePanelEffectsParams = {
  selectedDevice: string | null;
  streaming: boolean;
  autoRefresh: boolean;
  logsExpanded: boolean;
  dropdownOpen: boolean;
  dropdownRef: MutableRefObject<HTMLDivElement | null>;
  frameSourceRef: MutableRefObject<EventSource | null>;
  wsRef: MutableRefObject<WebSocket | null>;
  autoRefreshRef: MutableRefObject<ReturnType<typeof setInterval> | null>;
  fetchDevices: () => Promise<void>;
  captureScreenshot: () => Promise<void>;
  fetchLogs: () => Promise<void>;
  setHealth: Dispatch<SetStateAction<HealthPayload | null>>;
  setDropdownOpen: Dispatch<SetStateAction<boolean>>;
};

export function useMobilePanelEffects({
  selectedDevice,
  streaming,
  autoRefresh,
  logsExpanded,
  dropdownOpen,
  dropdownRef,
  frameSourceRef,
  wsRef,
  autoRefreshRef,
  fetchDevices,
  captureScreenshot,
  fetchLogs,
  setHealth,
  setDropdownOpen,
}: UseMobilePanelEffectsParams): void {
  useEffect(() => {
    void fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const response = await fetch("/api/agent/mobile/health", { cache: "no-store" });
        if (response.ok) {
          const payload = (await response.json()) as HealthPayload;
          setHealth(payload);
        }
      } catch {
        // Ignore health fetch errors
      }
    }
    void fetchHealth();
  }, [setHealth]);

  useEffect(() => {
    if (selectedDevice && !streaming) {
      void captureScreenshot();
    }
  }, [selectedDevice, streaming, captureScreenshot]);

  useEffect(() => {
    if (autoRefresh && selectedDevice) {
      autoRefreshRef.current = setInterval(() => {
        void captureScreenshot();
      }, 1000);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [autoRefresh, selectedDevice, captureScreenshot, autoRefreshRef]);

  useEffect(() => {
    if (logsExpanded && selectedDevice) {
      void fetchLogs();
      const interval = setInterval(() => void fetchLogs(), 2000);
      return () => clearInterval(interval);
    }
  }, [logsExpanded, selectedDevice, fetchLogs]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen, dropdownRef, setDropdownOpen]);

  useEffect(() => {
    return () => {
      if (frameSourceRef.current) frameSourceRef.current.close();
      if (wsRef.current) wsRef.current.close();
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [frameSourceRef, wsRef, autoRefreshRef]);
}
