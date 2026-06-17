import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function POST({ cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = parseInt(sessionId);
        db.prepare('UPDATE users SET discord_username = NULL, discord_id = NULL WHERE id = ?').run(userId);
        return json({ success: true });
    } catch (err) {
        console.error('Failed to unlink Discord details:', err);
        return json({ error: 'Failed to unlink account' }, { status: 500 });
    }
}
