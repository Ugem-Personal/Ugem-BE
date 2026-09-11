export type RealtimeEventType =
  | "CONNECTED"
  | "HEARTBEAT"
  | "notification:new"
  | "order:new"
  | "order:status_changed"
  | "order:bill_updated"
  | "booking:new"
  | "booking:status_changed"
  | "support:new_message";

export interface RealtimeMessage<T = unknown> {
  type: RealtimeEventType;
  payload: T;
  timestamp: string;
}

export interface RealtimeClient {
  id: string;
  userId: string;
  merchantId?: string | null;
  role: string;
  send: (event: RealtimeEventType, payload: unknown) => void;
  close: () => void;
}
