import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET({ url }) {
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return json({ error: 'Missing citizen identifier context' }, { status: 400 });
    }

    try {
        const userRow = db.prepare('SELECT id, username, avatar FROM users WHERE username = ? OR id = ?').get(userId, userId) as { id: number, username: string, avatar: string | null } | undefined;

        if (!userRow) {
            return json({
                first_cc: 0,
                last_cc: 0,
                avatar: null,
                history: []
            });
        }

        const stats = db.prepare('SELECT cc, type, created_at FROM userStats WHERE userId = ? ORDER BY id ASC').all(userRow.id) as { cc: number, type: string, created_at: string }[];

        const first_cc = stats.length > 0 ? stats[0].cc : 0;
        const last_cc = stats.length > 0 ? stats[stats.length - 1].cc : 0;

        return json({
            first_cc,
            last_cc,
            avatar: userRow.avatar,
            history: stats
        });

    } catch (err: any) {
        console.error('Database query block failure:', err.message);
        return json({ error: 'Failed to extract citizen record telemetry log' }, { status: 500 });
    }
}