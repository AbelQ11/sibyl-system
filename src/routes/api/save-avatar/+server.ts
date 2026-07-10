import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) {
        return json({ success: false, error: 'Unauthorized: Active session required.' }, { status: 401 });
    }

    try {
        const { avatar } = await request.json();


        const result = db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, user.id);

        if (result.changes === 0) {
            return json({ success: false, error: 'Target user file node not located.' }, { status: 404 });
        }

        return json({ success: true });
    } catch (err: any) {

        console.error('CRITICAL DATABASE OPERATION FAULT:', err.message || err);
        return json({ success: false, error: err.message || 'Internal Server Sync Failure' }, { status: 500 });
    }
};
