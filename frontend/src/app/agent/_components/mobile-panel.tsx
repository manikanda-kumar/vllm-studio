"use client";

import { useRef, useState } from "react";
import { useMobilePanelEffects } from "@/hooks/agent/use-mobile-panel-effects";
import { useMobilePanelActions } from "@/hooks/agent/use-mobile-panel-actions";
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Smartphone,
  Camera,
  Play,
  Square,
  Terminal,
  Home,
  ArrowLeft,
} from "lucide-react";

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

type Props = {
  cwd: string | null;
};

export function MobilePanel({ cwd }: Props) {
  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [tapping, setTapping] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const frameSourceRef = useRef<EventSource | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  const {
    fetchDevices,
    captureScreenshot,
    startStream,
    stopStream,
    handleScreenTap,
    sendButton,
    fetchLogs,
  } = useMobilePanelActions({
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
  });

  useMobilePanelEffects({
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
  });

  const selected = devices.find((d) => d.id === selectedDevice);

  if (!cwd) {
    return (
      <div className="flex h-full items-center justify-center text-center text-[11px] text-(--dim)">
        Pick a project to use mobile testing.
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar */}
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-(--border) px-2">
        {/* Device selector */}
        <div ref={dropdownRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            disabled={loading}
            className="flex h-7 w-full items-center gap-1.5 rounded border border-(--border) bg-(--surface) px-2 text-[11px] text-(--fg) hover:bg-(--bg) disabled:opacity-50"
          >
            <Smartphone className="h-3 w-3 shrink-0 text-(--dim)" />
            <span className="min-w-0 flex-1 truncate text-left">
              {loading
                ? "Loading…"
                : selected
                  ? `${selected.name}`
                  : devices.length === 0
                    ? "No devices"
                    : "Select"}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-(--dim)" />
          </button>
          {dropdownOpen && devices.length > 0 && (
            <div className="absolute left-0 top-8 z-50 w-full rounded border border-(--border) bg-(--surface) shadow-lg">
              {devices.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() => {
                    if (device.id !== selectedDevice) {
                      void stopStream();
                    }
                    setSelectedDevice(device.id);
                    setDropdownOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-(--bg) ${
                    device.id === selectedDevice ? "bg-(--bg) text-(--fg)" : "text-(--dim)"
                  }`}
                >
                  <Smartphone className="h-3 w-3 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{device.name}</span>
                  <span className="shrink-0 text-[9px] uppercase">{device.platform}</span>
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      device.state === "online" ? "bg-green-500" : "bg-(--dim)"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stream/Stop button */}
        {streaming ? (
          <button
            type="button"
            onClick={() => void stopStream()}
            className="flex h-7 w-7 items-center justify-center rounded border border-(--border) bg-red-500/20 text-red-400 hover:bg-red-500/30"
            title="Stop streaming"
          >
            <Square className="h-3 w-3" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void startStream()}
            disabled={!selectedDevice || !health?.supportedFeatures.stream}
            className="flex h-7 w-7 items-center justify-center rounded border border-(--border) bg-(--surface) text-(--dim) hover:bg-(--bg) hover:text-(--fg) disabled:opacity-50"
            title="Start live view"
          >
            <Play className="h-3 w-3" />
          </button>
        )}

        {/* Screenshot button */}
        <button
          type="button"
          onClick={() => void captureScreenshot()}
          disabled={!selectedDevice || screenshotLoading || !health?.supportedFeatures.screenshot}
          className="flex h-7 w-7 items-center justify-center rounded border border-(--border) bg-(--surface) text-(--dim) hover:bg-(--bg) hover:text-(--fg) disabled:opacity-50"
          title="Capture screenshot"
        >
          <Camera className={`h-3 w-3 ${screenshotLoading ? "animate-pulse" : ""}`} />
        </button>

        {/* Refresh devices */}
        <button
          type="button"
          onClick={() => void fetchDevices()}
          disabled={loading || !health?.supportedFeatures.devices}
          className="flex h-7 w-7 items-center justify-center rounded border border-(--border) bg-(--surface) text-(--dim) hover:bg-(--bg) hover:text-(--fg) disabled:opacity-50"
          title="Refresh devices"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>

        {/* Logs toggle */}
        <button
          type="button"
          onClick={() => setLogsExpanded(!logsExpanded)}
          disabled={!health?.supportedFeatures.logs}
          className={`flex h-7 w-7 items-center justify-center rounded border border-(--border) ${
            logsExpanded
              ? "bg-(--accent)/20 text-(--accent)"
              : "bg-(--surface) text-(--dim) hover:bg-(--bg) hover:text-(--fg)"
          } disabled:opacity-50`}
          title="Toggle logs"
        >
          <Terminal className="h-3 w-3" />
        </button>
      </div>

      {/* Health banners */}
      {health && !health.nodeVersionOk && (
        <div className="shrink-0 border-b border-(--border) bg-yellow-500/10 px-3 py-1.5 text-[10px] text-yellow-400">
          Install Node 22+ for mobile device support (found {health.nodeVersion}).
        </div>
      )}
      {health && health.platform === "win32" && (
        <div className="shrink-0 border-b border-(--border) bg-(--info)/10 px-3 py-1.5 text-[10px] text-(--info)">
          iOS device control requires macOS. Android tools are available on Windows.
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="shrink-0 border-b border-(--border) bg-(--err)/10 px-3 py-1.5 text-[10px] text-(--err)">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 text-(--dim) hover:text-(--fg)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Screen display */}
        <div
          className={`flex items-center justify-center overflow-auto bg-black/50 p-2 ${
            logsExpanded ? "min-h-0 flex-1" : "min-h-0 flex-1"
          }`}
        >
          {screenshotLoading && !streaming ? (
            <div className="text-[11px] text-(--dim)">Capturing…</div>
          ) : streamInfo?.streamUrl ? (
            <img
              ref={imgRef}
              src={streamInfo.streamUrl}
              alt="Device stream"
              className="max-h-full max-w-full cursor-crosshair rounded object-contain shadow-lg"
              onClick={handleScreenTap}
              draggable={false}
            />
          ) : screenshot ? (
            <img
              ref={imgRef}
              src={screenshot}
              alt="Device screen"
              className="max-h-full max-w-full cursor-crosshair rounded object-contain shadow-lg"
              onClick={handleScreenTap}
              draggable={false}
            />
          ) : selectedDevice ? (
            <div className="flex flex-col items-center gap-2 text-center text-[11px] text-(--dim)">
              <Camera className="h-6 w-6" />
              <span>Click Play for live view or Camera for screenshot</span>
            </div>
          ) : devices.length === 0 && !loading ? (
            <div className="flex flex-col items-center gap-3 text-center text-[11px] text-(--dim)">
              <Smartphone className="h-8 w-8" />
              <div>
                <p className="font-medium text-(--fg)">No devices online</p>
                <p className="mt-1">Start an emulator or connect a device</p>
              </div>
              <code className="mt-2 rounded bg-(--surface) px-2 py-1 text-[10px]">
                mobilecli devices --include-offline
              </code>
            </div>
          ) : null}
        </div>

        {/* Device buttons */}
        {selected && (
          <div className="flex h-8 shrink-0 items-center justify-center gap-2 border-t border-(--border) bg-(--surface)">
            {selected.platform === "android" && (
              <button
                type="button"
                onClick={() => void sendButton("BACK")}
                className="flex h-6 w-6 items-center justify-center rounded text-(--dim) hover:bg-(--bg) hover:text-(--fg)"
                title="Back"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => void sendButton("HOME")}
              className="flex h-6 w-6 items-center justify-center rounded text-(--dim) hover:bg-(--bg) hover:text-(--fg)"
              title="Home"
            >
              <Home className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Logs panel */}
        {logsExpanded && (
          <div className="flex h-32 shrink-0 flex-col border-t border-(--border)">
            <div className="flex h-6 shrink-0 items-center justify-between border-b border-(--border) px-2">
              <span className="text-[9px] uppercase tracking-wide text-(--dim)">Logs</span>
              <button
                type="button"
                onClick={() => setLogsExpanded(false)}
                className="rounded p-0.5 text-(--dim) hover:bg-(--surface) hover:text-(--fg)"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            <div
              ref={logsRef}
              className="min-h-0 flex-1 overflow-auto bg-black/30 p-2 font-mono text-[9px] text-(--dim)"
            >
              {logs.length === 0 ? (
                <span className="text-(--dim)">No logs yet…</span>
              ) : (
                logs.map((line, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    {line}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Device info footer */}
      {selected && (
        <div className="flex h-5 shrink-0 items-center gap-2 border-t border-(--border) px-2 text-[9px] text-(--dim)">
          <span className="truncate font-mono">{selected.id}</span>
          <span className="uppercase">{selected.type}</span>
          {streaming && (
            <span className="flex items-center gap-1 text-green-500">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              LIVE
            </span>
          )}
        </div>
      )}
    </div>
  );
}
