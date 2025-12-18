export type StreamRole = "streamer" | "viewer";
export type RoomActiveDisplay = "oled" | "seg7";

export type RoomState = {
  hasStreamer: boolean;
  viewers: number;
  viewerCap: number;
  lastSeq?: number;
  active?: RoomActiveDisplay;
  requiresPassword: boolean;
  createdAt?: number;
  updatedAt?: number;
};

export type BaseControlMsg = {
  t: string;
  roomId: string;
  clientId: string;
  ts?: number;
};

export type StreamerHelloMsg = BaseControlMsg & {
  t: "streamer:hello";
  passwordToken?: string;
  ownerKey: string;
  meta?: { device?: string; appVersion?: string; pollingMs?: number };
};

export type ViewerHelloMsg = BaseControlMsg & {
  t: "viewer:hello";
  passwordToken?: string;
};

export type DisplayActiveMsg = BaseControlMsg & {
  t: "display:active";
  active: RoomActiveDisplay;
};

export type PingMsg = BaseControlMsg & { t: "ping" };
export type ByeMsg = BaseControlMsg & { t: "bye" };

export type ViewerRequestFullMsg = BaseControlMsg & { t: "viewer:request_full" };
export type StreamerRequestFullMsg = BaseControlMsg & {
  t: "streamer:request_full";
};

export type OkMsg = BaseControlMsg & {
  t: "ok";
  role: StreamRole;
  roomState: RoomState;
};

export type ErrMsg = BaseControlMsg & { t: "err"; code: string; msg: string };

export type AnyControlMsg =
  | StreamerHelloMsg
  | ViewerHelloMsg
  | DisplayActiveMsg
  | PingMsg
  | ByeMsg
  | ViewerRequestFullMsg
  | StreamerRequestFullMsg
  | OkMsg
  | ErrMsg;

export function nowMs(): number {
  return Date.now();
}
