import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as env_static from '$env/static/private';

export async function GET({ url, request }) {
    const authHeader = request.headers.get('Authorization');
    const botSecret = (env_static as any).SIB_BOT_SECRET;
    if (!botSecret || authHeader !== `Bearer ${botSecret}`) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const discordId = url.searchParams.get('discordId');
    if (!discordId) return json({ error: 'Missing discordId' }, { status: 400 });

    const user = db.prepare('SELECT id, username FROM users WHERE discord_id = ?').get(discordId) as { id: number, username: string } | undefined;
    if (!user) return json({ error: 'UNLINKED', message: 'Discord account is not linked to any SIBYL profile.' }, { status: 404 });

    const history = db.prepare('SELECT cc, created_at FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 5').all(user.id);
    
    return json({
        success: true,
        username: user.username,
        history
    });
}
