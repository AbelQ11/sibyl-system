import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
/** Ensure this matches where your updated better-sqlite3 code lives! */
import { db } from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
    try {
        const { avatar, userId } = await request.json();

        if (!userId) {
            return json({ success: false, error: 'Unauthorized: Missing User ID string parameters.' }, { status: 400 });
        }

        /** We prepare the update query statement safely */
        const statement = db.prepare('UPDATE users SET avatar = ? WHERE username = ?');
        const result = statement.run(avatar, userId);

        if (result.changes === 0) {
            return json({ success: false, error: 'Target user file node not located.' }, { status: 404 });
        }

        return json({ success: true });
    } catch (err: any) {
        /** This will print the explicit database or syntax error straight to your PM2 logs window! */
        console.error('CRITICAL DATABASE OPERATION FAULT:', err.message || err);
        return json({ success: false, error: err.message || 'Internal Server Sync Failure' }, { status: 500 });
    }
};