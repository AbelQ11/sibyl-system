import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET({ url, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loggedInId = parseInt(sessionId);
    const userId = url.searchParams.get('userId');

    if (!userId) {
        return json({ error: 'Missing citizen identifier context' }, { status: 400 });
    }

    try {
        const userRow = db.prepare('SELECT id, username, avatar, privacy, citizen_id FROM users WHERE username = ? OR id = ?').get(userId, userId) as { id: number, username: string, avatar: string | null, privacy: string, citizen_id: string | null } | undefined;

        if (!userRow) {
            return json({
                first_cc: 0,
                last_cc: 0,
                avatar: null,
                citizen_id: null,
                history: []
            });
        }

        // Security check: Must respect privacy settings (PRIVATE, FRIENDS, PUBLIC) unless the requester is an admin
        const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(loggedInId) as { role: string } | undefined;
        const isAdmin = requester?.role === 'ADMIN';

        if (userRow.id !== loggedInId && !isAdmin) {
            const targetPrivacy = userRow.privacy || 'PRIVATE';
            if (targetPrivacy === 'PRIVATE') {
                return json({ error: 'Access Denied: Private Profile' }, { status: 403 });
            }

            if (targetPrivacy !== 'PUBLIC') {
                const isFriend = db.prepare(`
                    SELECT id FROM friend_requests
                    WHERE status = 'ACCEPTED' AND (
                        (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)
                    )
                `).get(loggedInId, userRow.id, userRow.id, loggedInId);

                if (!isFriend) {
                    return json({ error: 'Access Denied: Compliance sync link not established' }, { status: 403 });
                }
            }
        }

        const stats = db.prepare('SELECT cc, type, created_at FROM userStats WHERE userId = ? ORDER BY id ASC').all(userRow.id) as { cc: number, type: string, created_at: string }[];

        const first_cc = stats.length > 0 ? stats[0].cc : 0;
        const last_cc = stats.length > 0 ? stats[stats.length - 1].cc : 0;

        return json({
            first_cc,
            last_cc,
            avatar: userRow.avatar,
            citizen_id: userRow.citizen_id,
            history: stats
        });

    } catch (err: any) {
        console.error('Database query block failure:', err.message);
        return json({ error: 'Failed to extract citizen record telemetry log' }, { status: 500 });
    }
}