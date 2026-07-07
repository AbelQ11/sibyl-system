/**
 * In-memory store for Server-Sent Events (SSE) connections
 * This manages real-time messaging without a persistent database dependency like Socket.io
 */

type ChatClient = {
    /** db user IDs are numbers */
    userId: number;
    controller: ReadableStreamDefaultController;
};

export const chatStore = {
    clients: new Set<ChatClient>(),

    addClient(userId: number, controller: ReadableStreamDefaultController) {
        const client = { userId, controller };
        this.clients.add(client);
        
        return client;
    },

    removeClient(client: ChatClient) {
        this.clients.delete(client);
    },

    /** Broadcast a message to specific users or all users */
    broadcast(message: any, targetUserIds?: number[]) {
        const payload = `data: ${JSON.stringify(message)}\n\n`;

        this.clients.forEach(client => {
            if (!targetUserIds || targetUserIds.includes(client.userId)) {
                try {
                    client.controller.enqueue(new TextEncoder().encode(payload));
                } catch (e) {
                    /** Controller might be closed, remove the dead client */
                    this.removeClient(client);
                }
            }
        });
    }
};
