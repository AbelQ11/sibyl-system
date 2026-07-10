/**
 * In-memory store for Server-Sent Events (SSE) connections
 * This manages real-time messaging without a persistent database dependency like Socket.io
 */

type ChatClient = {

    userId: number;
    controller: ReadableStreamDefaultController;
};

export const chatStore = {
    clients: new Set<ChatClient>(),
    _heartbeatTimer: null as ReturnType<typeof setInterval> | null,

    addClient(userId: number, controller: ReadableStreamDefaultController) {
        const client = { userId, controller };
        this.clients.add(client);
        this._ensureHeartbeat();
        return client;
    },

    removeClient(client: ChatClient) {
        this.clients.delete(client);
    },


    broadcast(message: any, targetUserIds?: number[]) {
        const payload = `data: ${JSON.stringify(message)}\n\n`;

        this.clients.forEach(client => {
            if (!targetUserIds || targetUserIds.includes(client.userId)) {
                try {
                    client.controller.enqueue(new TextEncoder().encode(payload));
                } catch (e) {

                    this.removeClient(client);
                }
            }
        });
    },


    _ping() {
        const pingPayload = new TextEncoder().encode(': ping\n\n');
        this.clients.forEach(client => {
            try {
                client.controller.enqueue(pingPayload);
            } catch (e) {
                this.removeClient(client);
            }
        });
    },


    _ensureHeartbeat() {
        if (this._heartbeatTimer !== null) return;
        this._heartbeatTimer = setInterval(() => {
            if (this.clients.size === 0) {
                this.stopHeartbeat();
                return;
            }
            this._ping();
        }, 30_000);
    },


    stopHeartbeat() {
        if (this._heartbeatTimer !== null) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }
};
