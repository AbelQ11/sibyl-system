import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function POST({ cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = sessionId;
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
