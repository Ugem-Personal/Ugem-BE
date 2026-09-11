import { logger } from "../../common/utils/logger.js";
class RealtimeService {
    clients = new Map();
    userClients = new Map();
    merchantClients = new Map();
    heartbeatInterval = null;
    constructor() {
        this.startHeartbeat();
    }
    startHeartbeat() {
        if (this.heartbeatInterval)
            return;
        // Send heartbeat ping every 25 seconds to keep connections alive through reverse proxies
        this.heartbeatInterval = setInterval(() => {
            this.broadcast("HEARTBEAT", { time: new Date().toISOString() });
        }, 25_000);
        if (this.heartbeatInterval.unref) {
            this.heartbeatInterval.unref();
        }
    }
    registerClient(clientId, res, userId, role, merchantId) {
        const client = {
            id: clientId,
            userId,
            merchantId,
            role,
            send: (event, payload) => {
                try {
                    const message = {
                        type: event,
                        payload,
                        timestamp: new Date().toISOString(),
                    };
                    res.write(`event: ${event}\n`);
                    res.write(`data: ${JSON.stringify(message)}\n\n`);
                }
                catch (error) {
                    logger.warn("realtime.send_failed", { clientId, userId, error });
                }
            },
            close: () => {
                try {
                    res.end();
                }
                catch { }
            },
        };
        this.clients.set(clientId, client);
        // Map user -> clients
        if (!this.userClients.has(userId)) {
            this.userClients.set(userId, new Set());
        }
        this.userClients.get(userId).add(clientId);
        // Map merchant -> clients
        if (merchantId) {
            if (!this.merchantClients.has(merchantId)) {
                this.merchantClients.set(merchantId, new Set());
            }
            this.merchantClients.get(merchantId).add(clientId);
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
    unregisterClient(clientId) {
        const client = this.clients.get(clientId);
        if (!client)
            return;
        this.clients.delete(clientId);
        if (this.userClients.has(client.userId)) {
            const set = this.userClients.get(client.userId);
            set.delete(clientId);
            if (set.size === 0) {
                this.userClients.delete(client.userId);
            }
        }
        if (client.merchantId && this.merchantClients.has(client.merchantId)) {
            const set = this.merchantClients.get(client.merchantId);
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
    sendToUser(userId, event, payload) {
        const clientIds = this.userClients.get(userId);
        if (!clientIds || clientIds.size === 0)
            return 0;
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
    sendToMerchant(merchantId, event, payload) {
        const clientIds = this.merchantClients.get(merchantId);
        if (!clientIds || clientIds.size === 0)
            return 0;
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
    broadcast(event, payload) {
        let count = 0;
        for (const client of this.clients.values()) {
            client.send(event, payload);
            count++;
        }
        return count;
    }
    getActiveClientCount() {
        return this.clients.size;
    }
    getConnectedUserCount() {
        return this.userClients.size;
    }
}
export const realtimeService = new RealtimeService();
