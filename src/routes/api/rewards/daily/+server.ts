import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const dbUser = db.prepare('SELECT last_login_date FROM users WHERE id = ?').get(user.id) as any;
        const today = new Date().toISOString().split('T')[0];

        if (dbUser.last_login_date === today) {
            return json({ success: false, error: 'Already claimed today' }, { status: 400 });
        }

        const reward = 50;
        db.prepare('UPDATE users SET credits = credits + ?, last_login_date = ? WHERE id = ?').run(reward, today, user.id);

        return json({ success: true, reward, message: `Daily reward claimed: ${reward} credits.` });
    } catch (e) {
        return json({ error: 'Internal Server Error' }, { status: 500 });
    }
};
