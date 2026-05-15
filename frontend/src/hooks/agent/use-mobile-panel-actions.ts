import {
  useCallback,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type SetStateAction,
} from "react";

type MobileDevice = {
  id: string;
  name: string;
  platform: "ios" | "android";
  type: "real" | "emulator" | "simulator";
  state: "online" | "offline";
};

type StreamInfo = {
  url: string;
  streamUrl: string;
  wsUrl: string;
  port: number;
  device: string;
};

export type MobilePanelActions = {
  fetchDevices: () => Promise<void>;
  captureScreenshot: () => Promise<void>;
  startStream: () => Promise<void>;
  stopStream: () => Promise<void>;
  handleScreenTap: (event: ReactMouseEvent<HTMLImageElement>) => Promise<void>;
  sendButton: (button: string) => Promise<void>;
  fetchLogs: () => Promise<void>;
};

type UseMobilePanelActionsParams = {
  selectedDevice: string | null;
  devices: MobileDevice[];
  tapping: boolean;
  streamInfo: StreamInfo | null;
  imgRef: MutableRefObject<HTMLImageElement | null>;
  wsRef: MutableRefObject<WebSocket | null>;
  frameSourceRef: MutableRefObject<EventSource | null>;
  logsRef: MutableRefObject<HTMLDivElement | null>;
  setDevices: Dispatch<SetStateAction<MobileDevice[]>>;
  setSelectedDevice: Dispatch<SetStateAction<string | null>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setScreenshot: Dispatch<SetStateAction<string | null>>;
  setScreenshotLoading: Dispatch<SetStateAction<boolean>>;
  setStreaming: Dispatch<SetStateAction<boolean>>;
  setStreamInfo: Dispatch<SetStateAction<StreamInfo | null>>;
  setAutoRefresh: Dispatch<SetStateAction<boolean>>;
  setLogs: Dispatch<SetStateAction<string[]>>;
  setTapping: Dispatch<SetStateAction<boolean>>;
};

export function useMobilePanelActions(params: UseMobilePanelActionsParams): MobilePanelActions {
  const {
    selectedDevice,
    devices,
    tapping,
    streamInfo,
    imgRef,
    wsRef,
    frameSourceRef,
    logsRef,
    setDevices,
    setSelectedDevice,
    setLoading,
    setError,
    setScreenshot,
    setScreenshotLoading,
    setStreaming,
    setStreamInfo,
    setAutoRefresh,
    setLogs,
    setTapping,
  } = params;

  const fetchDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/agent/mobile/devices", { cache: "no-store" });
      const payload = (await response.json()) as { devices?: MobileDevice[]; error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const online = (payload.devices ?? []).filter((d) => d.state === "online");
      setDevices(online);
      const currentStillOnline = selectedDevice && online.some((d) => d.id === selectedDevice);
      if (online.length > 0 && !currentStillOnline) {
        setSelectedDevice(online[0].id);
      } else if (online.length === 0) {
        setSelectedDevice(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list devices");
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, setDevices, setSelectedDevice, setLoading, setError]);

  const captureScreenshot = useCallback(async () => {
    if (!selectedDevice) return;
    setScreenshotLoading(true);
    try {
      const response = await fetch(
        `/api/agent/mobile/screenshot?device=${encodeURIComponent(selectedDevice)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      setScreenshot(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Screenshot failed");
    } finally {
      setScreenshotLoading(false);
    }
  }, [selectedDevice, setScreenshot, setScreenshotLoading, setError]);

  const startStream = useCallback(async () => {
    if (!selectedDevice) return;
    const selected = devices.find((d) => d.id === selectedDevice);
    if (!selected) return;

    if (frameSourceRef.current) {
      frameSourceRef.current.close();
      frameSourceRef.current = null;
    }

    if (selected.platform === "ios" && selected.type === "simulator") {
      try {
        const response = await fetch("/api/agent/mobile/stream/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ device: selectedDevice }),
        });
        const payload = (await response.json()) as StreamInfo & { error?: string };
        if (response.ok && !payload.error) {
          setStreamInfo(payload);
          const ws = new WebSocket(payload.wsUrl);
          ws.binaryType = "arraybuffer";
          wsRef.current = ws;
        }
      } catch {
        // serve-sim unavailable, continue with SSE frames only
      }
    }

    const es = new EventSource(
      `/api/agent/mobile/frames?device=${encodeURIComponent(selectedDevice)}`,
    );
    frameSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as
          | { type: "frame"; data: string; mimeType: string }
          | { type: "error"; error: string };

        if (data.type === "frame") {
          setScreenshot(`data:${data.mimeType};base64,${data.data}`);
          setError(null);
        } else if (data.type === "error") {
          setError(data.error);
        }
      } catch {
        // Ignore parse errors (e.g., ping comments)
      }
    };

    es.onerror = () => {
      setError("Frame stream interrupted, reconnecting...");
    };

    setStreaming(true);
  }, [
    selectedDevice,
    devices,
    frameSourceRef,
    wsRef,
    setStreamInfo,
    setScreenshot,
    setError,
    setStreaming,
  ]);

  const stopStream = useCallback(async () => {
    setStreaming(false);
    setAutoRefresh(false);
    if (frameSourceRef.current) {
      frameSourceRef.current.close();
      frameSourceRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamInfo) {
      await fetch("/api/agent/mobile/stream/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device: selectedDevice }),
      }).catch(() => {});
      setStreamInfo(null);
    }
  }, [
    streamInfo,
    selectedDevice,
    frameSourceRef,
    wsRef,
    setStreaming,
    setAutoRefresh,
    setStreamInfo,
  ]);

  const handleScreenTap = useCallback(
    async (event: ReactMouseEvent<HTMLImageElement>) => {
      if (!selectedDevice || tapping) return;
      const img = imgRef.current;
      if (!img) return;

      const rect = img.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const normX = x / rect.width;
      const normY = y / rect.height;
      const deviceX = Math.round(normX * img.naturalWidth);
      const deviceY = Math.round(normY * img.naturalHeight);

      setTapping(true);
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const buffer = new ArrayBuffer(9);
          const view = new DataView(buffer);
          view.setUint8(0, 0x03);
          view.setFloat32(1, normX, true);
          view.setFloat32(5, normY, true);
          wsRef.current.send(buffer);
        } else {
          await fetch("/api/agent/mobile/tap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: selectedDevice, x: deviceX, y: deviceY }),
          });
        }
        setTimeout(() => void captureScreenshot(), 300);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Tap failed");
      } finally {
        setTapping(false);
      }
    },
    [selectedDevice, tapping, captureScreenshot, imgRef, wsRef, setTapping, setError],
  );

  const sendButton = useCallback(
    async (button: string) => {
      if (!selectedDevice) return;
      try {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const encoder = new TextEncoder();
          const buttonBytes = encoder.encode(button);
          const buffer = new ArrayBuffer(1 + buttonBytes.length);
          const view = new Uint8Array(buffer);
          view[0] = 0x04;
          view.set(buttonBytes, 1);
          wsRef.current.send(buffer);
        } else {
          await fetch("/api/agent/mobile/button", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device: selectedDevice, button }),
          });
        }
        setTimeout(() => void captureScreenshot(), 300);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Button press failed");
      }
    },
    [selectedDevice, captureScreenshot, wsRef, setError],
  );

  const fetchLogs = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      const response = await fetch(
        `/api/agent/mobile/logs?device=${encodeURIComponent(selectedDevice)}&lines=50`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as { logs?: string[]; error?: string };
      if (response.ok && payload.logs) {
        setLogs(payload.logs);
        if (logsRef.current) {
          logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
      }
    } catch {
      // Ignore log fetch errors
    }
  }, [selectedDevice, setLogs, logsRef]);

  return {
    fetchDevices,
    captureScreenshot,
    startStream,
    stopStream,
    handleScreenTap,
    sendButton,
    fetchLogs,
  };
}
