import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function POST({ request }) {
    try {
        const { cc, userId } = await request.json();
        
        if (!userId) {
            return json({ error: 'Missing citizen identifier context' }, { status: 400 });
        }

        const userRow = db.prepare('SELECT id FROM users WHERE username = ? OR id = ?').get(userId, userId) as { id: number } | undefined;
        
        if (!userRow) {
            return json({ error: 'Unauthorized: Citizen identification required' }, { status: 401 });
        }

        db.prepare("INSERT INTO userStats (userId, cc, type) VALUES (?, ?, 'biometric')").run(userRow.id, cc);

        /** Discord webhook integration removed. */

        return json({ success: true });
    } catch (err: any) {
        console.error('Failed to save biometric scan CC:', err.message);
        return json({ error: 'Database tracking failure' }, { status: 500 });
    }
}
