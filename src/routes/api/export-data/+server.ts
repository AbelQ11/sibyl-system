import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        /** Exclude password hash from export */
        delete user.password;

        const stats = db.prepare(`SELECT * FROM userStats WHERE userId = ?`).all(user.id);
        const sentMessages = db.prepare(`SELECT * FROM chat_messages WHERE senderId = ?`).all(user.id);
        const receivedMessages = db.prepare(`SELECT * FROM chat_messages WHERE receiverId = ?`).all(user.id);
        const groups = db.prepare(`SELECT * FROM chat_group_members WHERE userId = ?`).all(user.id);
        const friends = db.prepare(`SELECT * FROM friend_requests WHERE senderId = ? OR receiverId = ?`).all(user.id, user.id);

        const exportData = {
            profile: user,
            biometric_history: stats,
            messages_sent: sentMessages,
            messages_received: receivedMessages,
            groups: groups,
            friend_requests: friends,
            exported_at: new Date().toISOString(),
            system: 'SIBYL SYSTEM'
        };

        return new Response(JSON.stringify(exportData, null, 2), {
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="sibyl_dossier_${user.citizen_id}.json"`
            }
        });

    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
