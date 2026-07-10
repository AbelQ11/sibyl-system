import { chatStore } from '$lib/server/chatStore';
import { getSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies, setHeaders }) => {
    const session = getSession(cookies.get('session'));
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }
    const user = { id: session.userId };

    setHeaders({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
    });

    const stream = new ReadableStream({
        start(controller) {
            const client = chatStore.addClient(user.id, controller);


            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'connected', userId: user.id })}\n\n`));

            /**
             * Handle client disconnect
             * Since we don't have direct close events on ReadableStream in SvelteKit endpoints,
             * we ping the client occasionally and catch errors in the broadcast to remove dead clients.
             */
            

            const pingInterval = setInterval(() => {
                try {
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: 'ping' })}\n\n`));
                } catch (e) {
                    clearInterval(pingInterval);
                    chatStore.removeClient(client);
                }
            }, 30000);
            

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
