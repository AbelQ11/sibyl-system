import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = db.prepare(`
        SELECT id, username, avatar, role 
        FROM users 
        WHERE id = ?
    `).get(sessionId) as any;

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { text, targetType, targetId, isReadOnce } = body;

        if (!text || typeof text !== 'string') {
            return json({ error: 'Message text is required' }, { status: 400 });
        }

        if (text.length > 250) {
            return json({ error: 'Message exceeds 250 characters limit' }, { status: 400 });
        }

        /** Get sender's last CC for hue coloring */
        const stats = db.prepare(`
            SELECT cc FROM userStats 
            WHERE userId = ? 
            ORDER BY created_at DESC LIMIT 1
        `).get(user.id) as { cc: number } | undefined;
        
        const cc = stats ? stats.cc : 0;

        let receiverId = null;
        let groupId = null;

        if (targetType === 'PRIVATE') {
            receiverId = targetId;
        } else if (targetType === 'GROUP') {
            groupId = targetId;
            /** Check if user is in group or is admin */
            if (user.role !== 'ADMIN') {
                const isMember = db.prepare(`
                    SELECT 1 FROM chat_group_members WHERE groupId = ? AND userId = ?
                `).get(groupId, user.id);
                if (!isMember) {
                    return json({ error: 'Not a member of this group' }, { status: 403 });
                }
            }
        } else {
            /** Public chat slowmode check */
            if (user.role !== 'ADMIN') {
                const lastMessage = db.prepare(`
                    SELECT created_at FROM chat_messages 
                    WHERE senderId = ? AND groupId IS NULL AND receiverId IS NULL 
                    ORDER BY created_at DESC LIMIT 1
                `).get(user.id) as any;
                
                if (lastMessage) {
                    const createdStr = lastMessage.created_at.includes('T') ? lastMessage.created_at : lastMessage.created_at.replace(' ', 'T') + 'Z';
                    const lastMessageTime = new Date(createdStr).getTime();
                    const now = Date.now();
                    const diff = now - lastMessageTime;
                    if (diff < 5000) {
                        return json({ error: `Public comms slowmode active. Please wait ${Math.ceil((5000 - diff) / 1000)} seconds.` }, { status: 429 });
                    }
                }
            }
        }

        /** Insert into DB (even read-once messages go to DB temporarily until read) */
        const info = db.prepare(`
            INSERT INTO chat_messages (senderId, receiverId, groupId, text, isReadOnce)
            VALUES (?, ?, ?, ?, ?)
        `).run(user.id, receiverId, groupId, text, isReadOnce ? 1 : 0);

        const messageId = info.lastInsertRowid;

        /** Group name fetch if applicable */
        let groupName = null;
        if (groupId) {
            const group = db.prepare(`SELECT name FROM chat_groups WHERE id = ?`).get(groupId) as { name: string } | undefined;
            if (group) groupName = group.name;
        }

        /** Sender's primary group name */
        const senderGroupRow = db.prepare(`
            SELECT cg.id, cg.name 
            FROM chat_group_members cgm 
            JOIN chat_groups cg ON cgm.groupId = cg.id 
            WHERE cgm.userId = ? LIMIT 1
        `).get(user.id) as { id: number, name: string } | undefined;
        const senderGroupName = senderGroupRow ? senderGroupRow.name : null;
        const senderGroupId = senderGroupRow ? senderGroupRow.id : null;

        const messagePayload = {
            id: messageId,
            targetType,
            senderId: user.id,
            senderName: user.username,
            senderAvatar: user.avatar,
            senderCC: cc,
            senderRole: user.role,
            receiverId,
            groupId,
            groupName,
            senderGroupName,
            senderGroupId,
            text,
            isReadOnce: Boolean(isReadOnce),
            created_at: new Date().toISOString()
        };

        /** Broadcast logic */
        if (user.role === 'ADMIN' && targetType === 'GLOBAL') {
            /** Admin global broadcast */
            chatStore.broadcast({ type: 'message', message: messagePayload });
            
            /** Webhook to Discord Bot */
            try {
                fetch('http://127.0.0.1:3005/webhook', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.SIB_BOT_SECRET}`
                    },
                    body: JSON.stringify({
                        action: 'GLOBAL_ANNOUNCEMENT',
                        payload: { text }
                    })
                }).catch(console.error);
            } catch (e) {
                console.error("Webhook failed:", e);
            }

        } else if (targetType === 'PUBLIC') {
            chatStore.broadcast({ type: 'message', message: messagePayload });

        } else if (targetType === 'PRIVATE') {
            chatStore.broadcast({ type: 'message', message: messagePayload }, [user.id, receiverId]);
        } else if (targetType === 'GROUP') {
            /** Fetch all group members */
            const members = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`).all(groupId) as { userId: number }[];
            const memberIds = members.map(m => m.userId);
            /**
             * Include admin if they are monitoring? Actually just send to members.
             * If sender is admin and not in group, add sender to target list so they see their own message
             */
            if (!memberIds.includes(user.id)) memberIds.push(user.id);
            
            chatStore.broadcast({ type: 'message', message: messagePayload }, memberIds);

        }

        return json({ success: true, message: messagePayload });

    } catch (e: any) {
        console.error("Error sending message:", e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
