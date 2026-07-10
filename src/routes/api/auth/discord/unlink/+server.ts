import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';

export async function POST({ cookies }) {
    const session = getSession(cookies.get('session'));
    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = session.userId;
        db.prepare('UPDATE users SET discord_username = NULL, discord_id = NULL WHERE id = ?').run(userId);
        return json({ success: true });
    } catch (err) {
        console.error('Failed to unlink Discord details:', err);
        return json({ error: 'Failed to unlink account' }, { status: 500 });
    }
}
