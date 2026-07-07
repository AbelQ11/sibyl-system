import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';

export async function GET({ request, url, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminUser = db.prepare('SELECT role, username FROM users WHERE id = ?').get(sessionId) as { role: string, username: string } | undefined;
    const adminAccountId = env.ADMIN_ACCOUNT_ID || 'Makishimadmin';
    
    if (!adminUser || (adminUser.role !== 'ADMIN' && adminUser.username !== adminAccountId)) {
        return json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const targetUsername = url.searchParams.get('username');
    if (!targetUsername) {
        return json({ error: 'Missing target username' }, { status: 400 });
    }

    try {
        const targetUser = db.prepare('SELECT id FROM users WHERE username = ?').get(targetUsername) as { id: number } | undefined;
        if (!targetUser) {
            return json({ error: 'Target user not found' }, { status: 404 });
        }

        const messages = db.prepare(`
            SELECT m.*, 
                   u.username as senderName, 
                   u.avatar as senderAvatar, 
                   u.role as senderRole,
                   (SELECT cc FROM userStats WHERE userId = u.id ORDER BY created_at DESC LIMIT 1) as senderCC
            FROM chat_messages m
            JOIN users u ON m.senderId = u.id
            WHERE m.groupId IS NULL AND m.receiverId IS NOT NULL AND (m.senderId = ? OR m.receiverId = ?)
            ORDER BY m.created_at ASC
        `).all(targetUser.id, targetUser.id) as any[];

        /** Group messages by the "other" person */
        const conversations: Record<number, { otherUserId: number, otherUsername: string, messages: any[] }> = {};

        for (const msg of messages) {
            const otherUserId = msg.senderId === targetUser.id ? msg.receiverId : msg.senderId;
            /** Get other username */
            if (!conversations[otherUserId]) {
                const otherUserRow = db.prepare('SELECT username FROM users WHERE id = ?').get(otherUserId) as { username: string };
                conversations[otherUserId] = {
                    otherUserId,
                    otherUsername: otherUserRow ? otherUserRow.username : 'Unknown',
                    messages: []
                };
            }
            conversations[otherUserId].messages.push(msg);
        }

        return json({ success: true, conversations: Object.values(conversations) });

    } catch (e: any) {
        console.error("Surveillance fetch failed:", e);
        return json({ error: 'Internal system error' }, { status: 500 });
    }
}
