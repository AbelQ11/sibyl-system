import { chatStore } from '$lib/server/chatStore';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, setHeaders }) => {
    const sessionId = cookies.get('session');
    
    /** Auth check */
    if (!sessionId) {
        return new Response('Unauthorized', { status: 401 });
    }
    
    const user = db.prepare("SELECT id FROM users WHERE id = ?").get(sessionId) as { id: number } | undefined;
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    setHeaders({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const stream = new ReadableStream({
        start(controller) {
            const client = chatStore.addClient(user.id, controller);

            /** Send an initial connected message */
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`));

            /**
             * Handle client disconnect
             * Since we don't have direct close events on ReadableStream in SvelteKit endpoints,
             * we ping the client occasionally and catch errors in the broadcast to remove dead clients.
             */
            
            /** 30s ping */
            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`));
                } catch (e) {
                    clearInterval(pingInterval);
                    chatStore.removeClient(client);
                }
            }, 30000);
            
            /** Clean up when the stream is cancelled by the client */
            return () => {
                clearInterval(pingInterval);
                chatStore.removeClient(client);
            };
        },
        /**
         * This is supposed to run when the client disconnects, but behavior varies across adapters.
         * We rely on the ping interval as a fallback.
         */
        cancel() {
        }
    });

    return new Response(stream);
};
