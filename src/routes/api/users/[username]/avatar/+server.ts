import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
    const username = params.username;
    if (!username) return new Response('Not found', { status: 404 });

    const user = db.prepare('SELECT avatar FROM users WHERE username = ?').get(username) as any;
    if (user && user.avatar && user.avatar.startsWith('data:image')) {
        const matches = user.avatar.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
            const mime = matches[1];
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');
            return new Response(buffer, {
                headers: {
                    'Content-Type': mime,
                    'Cache-Control': 'public, max-age=86400'
                }
            });
        }
    }

    /** Default 1x1 transparent png if not found or invalid */
    const empty = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    return new Response(empty, { headers: { 'Content-Type': 'image/png' }});
};
