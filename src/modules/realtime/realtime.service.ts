import type { Response } from "express";
import { logger } from "../../common/utils/logger.js";
import type { RealtimeClient, RealtimeEventType, RealtimeMessage } from "./realtime.types.js";

class RealtimeService {
  private clients: Map<string, RealtimeClient> = new Map();
  private userClients: Map<string, Set<string>> = new Map();
  private merchantClients: Map<string, Set<string>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;

    // Send heartbeat ping every 25 seconds to keep connections alive through reverse proxies
    this.heartbeatInterval = setInterval(() => {
      this.broadcast("HEARTBEAT", { time: new Date().toISOString() });
    }, 25_000);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  public registerClient(
    clientId: string,
    res: Response,
    userId: string,
    role: string,
    merchantId?: string | null,
  ): RealtimeClient {
    const client: RealtimeClient = {
      id: clientId,
      userId,
      merchantId,
      role,
      send: (event: RealtimeEventType, payload: unknown) => {
        try {
          const message: RealtimeMessage = {
            type: event,
            payload,
            timestamp: new Date().toISOString(),
          };
          res.write(`event: ${event}\n`);
          res.write(`data: ${JSON.stringify(message)}\n\n`);
        } catch (error) {
          logger.warn("realtime.send_failed", { clientId, userId, error });
        }
      },
      close: () => {
        try {
          res.end();
        } catch {}
      },
    };

    this.clients.set(clientId, client);

    // Map user -> clients
    if (!this.userClients.has(userId)) {
      this.userClients.set(userId, new Set());
    }
    this.userClients.get(userId)!.add(clientId);

    // Map merchant -> clients
    if (merchantId) {
      if (!this.merchantClients.has(merchantId)) {
        this.merchantClients.set(merchantId, new Set());
      }
      this.merchantClients.get(merchantId)!.add(clientId);
    }

    logger.debug("realtime.client_registered", {
      clientId,
      userId,
      merchantId,
      totalClients: this.clients.size,
    });

    // Send initial handshake
    client.send("CONNECTED", {
      clientId,
      userId,
      merchantId,
      role,
    });

    return client;
  }

  public unregisterClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);

    if (this.userClients.has(client.userId)) {
      const set = this.userClients.get(client.userId)!;
      set.delete(clientId);
      if (set.size === 0) {
        this.userClients.delete(client.userId);
      }
    }

    if (client.merchantId && this.merchantClients.has(client.merchantId)) {
      const set = this.merchantClients.get(client.merchantId)!;
      set.delete(clientId);
      if (set.size === 0) {
        this.merchantClients.delete(client.merchantId);
      }
    }

    logger.debug("realtime.client_unregistered", {
      clientId,
      userId: client.userId,
      totalClients: this.clients.size,
    });
  }

  public sendToUser(userId: string, event: RealtimeEventType, payload: unknown): number {
    const clientIds = this.userClients.get(userId);
    if (!clientIds || clientIds.size === 0) return 0;

    let count = 0;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        client.send(event, payload);
        count++;
      }
    }
    return count;
  }

  public sendToMerchant(merchantId: string, event: RealtimeEventType, payload: unknown): number {
    const clientIds = this.merchantClients.get(merchantId);
    if (!clientIds || clientIds.size === 0) return 0;

    let count = 0;
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        client.send(event, payload);
        count++;
      }
    }
    return count;
  }

  public broadcast(event: RealtimeEventType, payload: unknown): number {
    let count = 0;
    for (const client of this.clients.values()) {
      client.send(event, payload);
      count++;
    }
    return count;
  }

  public getActiveClientCount(): number {
    return this.clients.size;
  }

  public getConnectedUserCount(): number {
    return this.userClients.size;
  }
}

export const realtimeService = new RealtimeService();
