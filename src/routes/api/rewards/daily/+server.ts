import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const today = new Date().toISOString().split('T')[0];
		const reward = 50;

		// A single conditional UPDATE makes concurrent claims impossible.
		const result = db
			.prepare(
				`
            UPDATE users
            SET credits = credits + ?, last_login_date = ?
            WHERE id = ? AND (last_login_date IS NULL OR last_login_date != ?)
        `
			)
			.run(reward, today, user.id, today);

		if (result.changes === 0) {
			return json({ success: false, error: 'Already claimed today' }, { status: 400 });
		}

		return json({ success: true, reward, message: `Daily reward claimed: ${reward} credits.` });
	} catch (e) {
		console.error('Daily reward error:', e);
		return json({ error: 'Internal Server Error' }, { status: 500 });
	}
};
