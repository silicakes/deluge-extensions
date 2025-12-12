import type { StreamRole } from "./control";

const DEFAULT_LOCAL_RELAY_PORT = 8787;

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}

function hostnameFromLocation(location: Location): string {
  const maybeHostname = (location as Location & { hostname?: string }).hostname;
  if (maybeHostname) return maybeHostname;

  const host = location.host ?? "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end !== -1) return host.slice(1, end);
  }

  const idx = host.indexOf(":");
  return idx === -1 ? host : host.slice(0, idx);
}

function formatHostnameForUrl(hostname: string): string {
  if (!hostname) return hostname;
  if (hostname.includes(":") && !hostname.startsWith("[")) return `[${hostname}]`;
  return hostname;
}

function isPrivateIpv4(hostname: string): boolean {
  const m = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const octets = m.slice(1).map(Number);
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  if (h.endsWith(".local")) return true;
  return isPrivateIpv4(h);
}

function defaultStreamHostFromLocation(location: Location): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const hostname = hostnameFromLocation(location);
  if (hostname && isLocalHostname(hostname)) {
    return `${proto}//${formatHostnameForUrl(hostname)}:${DEFAULT_LOCAL_RELAY_PORT}`;
  }
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
