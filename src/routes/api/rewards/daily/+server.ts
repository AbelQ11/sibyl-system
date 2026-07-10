import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';

export async function POST({ cookies }) {
    const session = getSession(cookies.get('session'));
    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;
    const today = new Date().toISOString().split('T')[0];

    try {
        const userData = db.prepare('SELECT last_login_date FROM users WHERE id = ?').get(userId) as { last_login_date: string };
        
        if (userData && userData.last_login_date !== today) {
            db.prepare('UPDATE users SET last_login_date = ?, credits = credits + 50 WHERE id = ?').run(today, userId);
            return json({ success: true, reward: 50, message: 'Daily connection reward claimed.' });
        }
        
        return json({ success: false, reward: 0, message: 'Reward already claimed today.' });
    } catch (e) {
        console.error('Failed to claim daily reward:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
