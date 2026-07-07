import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    const sessionId = cookies.get('session');
    
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(sessionId) as any;
    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        /**
         * Fetch public messages, messages addressed to user, messages sent by user, 
         * and messages in groups the user belongs to.
         * For admin, fetch everything (or everything public/global for simplicity).
         */
        
        let messagesQuery = `
            SELECT m.*, 
                   u.username as senderName, 
                   u.avatar as senderAvatar, 
                   u.role as senderRole,
                   (SELECT cc FROM userStats WHERE userId = u.id ORDER BY created_at DESC LIMIT 1) as senderCC,
                   g.name as groupName,
                   (SELECT cg.name FROM chat_group_members cgm JOIN chat_groups cg ON cgm.groupId = cg.id WHERE cgm.userId = u.id LIMIT 1) as senderGroupName,
                   (SELECT cg.id FROM chat_group_members cgm JOIN chat_groups cg ON cgm.groupId = cg.id WHERE cgm.userId = u.id LIMIT 1) as senderGroupId
            FROM chat_messages m
            JOIN users u ON m.senderId = u.id
            LEFT JOIN chat_groups g ON m.groupId = g.id
            WHERE (m.groupId IS NULL AND m.receiverId IS NULL) 
               OR m.receiverId = ? 
               OR m.senderId = ?
               OR m.groupId IN (SELECT groupId FROM chat_group_members WHERE userId = ?)
            ORDER BY m.created_at ASC
            LIMIT 200
        `;

        if (user.role === 'ADMIN') {
            /** Admin sees all (except maybe private messages they aren't part of unless they want to, but let's just let them see all for monitoring) */
            messagesQuery = `
                SELECT m.*, 
                       u.username as senderName, 
                       u.avatar as senderAvatar, 
                       u.role as senderRole,
                       (SELECT cc FROM userStats WHERE userId = u.id ORDER BY created_at DESC LIMIT 1) as senderCC,
                       g.name as groupName,
                       (SELECT cg.name FROM chat_group_members cgm JOIN chat_groups cg ON cgm.groupId = cg.id WHERE cgm.userId = u.id LIMIT 1) as senderGroupName,
                       (SELECT cg.id FROM chat_group_members cgm JOIN chat_groups cg ON cgm.groupId = cg.id WHERE cgm.userId = u.id LIMIT 1) as senderGroupId
                FROM chat_messages m
                JOIN users u ON m.senderId = u.id
                LEFT JOIN chat_groups g ON m.groupId = g.id
                ORDER BY m.created_at ASC
                LIMIT 200
            `;
        }

        let rawMessages;
        if (user.role === 'ADMIN') {
            rawMessages = db.prepare(messagesQuery).all() as any[];
        } else {
            rawMessages = db.prepare(messagesQuery).all(user.id, user.id, user.id) as any[];
        }

        /** Format to match the SSE payload structure */
        const formattedMessages = rawMessages.map(m => ({
            id: m.id,
            senderId: m.senderId,
            senderName: m.senderRole === 'ADMIN' ? 'XXXXXXXXXX' : m.senderName,
            senderAvatar: m.senderAvatar,
            senderCC: m.senderCC || 0,
            senderRole: m.senderRole,
            receiverId: m.receiverId,
            groupId: m.groupId,
            groupName: m.groupName,
            senderGroupName: m.senderGroupName,
            senderGroupId: m.senderGroupId,
            text: m.text,
            isReadOnce: Boolean(m.isReadOnce),
            created_at: m.created_at.includes('T') ? m.created_at : m.created_at.replace(' ', 'T') + 'Z'
        }));

        return json({ messages: formattedMessages });

    } catch (e: any) {
        console.error("Error fetching messages:", e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
