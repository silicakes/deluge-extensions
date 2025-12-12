import type { StreamRole } from "./control";

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function defaultStreamHostFromLocation(location: Location): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}`;
}

function normalizeStreamHost(
  streamHost: string,
  location: Location,
): string {
  const host = stripTrailingSlash(streamHost.trim());
  if (!host) return defaultStreamHostFromLocation(location);
  if (host.startsWith("wss://") || host.startsWith("ws://")) return host;
  if (host.startsWith("https://"))
    return `wss://${host.slice("https://".length)}`;
  if (host.startsWith("http://"))
    return `ws://${host.slice("http://".length)}`;
  const proto = location.protocol === "https:" ? "wss://" : "ws://";
  return `${proto}${host}`;
}

export function getStreamHostOverrideFromQuery(
  location: Location,
): string | null {
  const params = new URLSearchParams(location.search);
  return params.get("streamHost");
}

export function getDefaultStreamHost(location: Location): string {
  const fromQuery = getStreamHostOverrideFromQuery(location);
  if (fromQuery) return normalizeStreamHost(fromQuery, location);

  const fromEnv = (import.meta.env.VITE_STREAM_HOST ?? "").trim();
  if (fromEnv) return normalizeStreamHost(fromEnv, location);

  return defaultStreamHostFromLocation(location);
}

export function buildRoomWsUrl(params: {
  roomId: string;
  role: StreamRole;
  streamHost?: string;
  location?: Location;
}): string {
  const location = params.location ?? window.location;
  const base = params.streamHost
    ? normalizeStreamHost(params.streamHost, location)
    : getDefaultStreamHost(location);
  const roomIdEsc = encodeURIComponent(params.roomId);
  return `${base}/api/rooms/${roomIdEsc}/ws?role=${params.role}`;
}
