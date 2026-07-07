import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import { queryAI } from '$lib/server/aiFallbackEngine';
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
        const { text, targetType, targetId, isReadOnce, replyToId, attachment } = body;

        if (!text || typeof text !== 'string') {
            return json({ error: 'Message text is required' }, { status: 400 });
        }

        if (text.length > 250) {
            return json({ error: 'Message exceeds 250 characters limit' }, { status: 400 });
        }

        if (replyToId) {
            const parent = db.prepare('SELECT isReadOnce FROM chat_messages WHERE id = ?').get(replyToId) as { isReadOnce: number } | undefined;
            if (!parent) return json({ error: 'Parent message not found' }, { status: 404 });
            if (parent.isReadOnce) return json({ error: 'Cannot reply to a classified Read-Once message' }, { status: 403 });
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
            INSERT INTO chat_messages (senderId, receiverId, groupId, text, isReadOnce, replyToId, attachment)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(user.id, receiverId, groupId, text, isReadOnce ? 1 : 0, replyToId || null, attachment || null);

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

        let replyToMessage = null;
        if (replyToId) {
            const parent = db.prepare(`
                SELECT m.text, u.username as senderName,
                       (SELECT AVG(cc) FROM userStats WHERE userId = u.id) as avgCC
                FROM chat_messages m
                JOIN users u ON m.senderId = u.id
                WHERE m.id = ?
            `).get(replyToId) as any;
            
            if (parent) {
                replyToMessage = {
                    text: parent.text,
                    senderName: parent.senderName,
                    senderAvgCC: Math.round(parent.avgCC || 0)
                };
            }
        }

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
            replyToId: replyToId || null,
            replyToMessage,
            attachment: attachment || null,
            reactions: [],
            created_at: new Date().toISOString()
        };

        /** Broadcast logic */
        if (user.role === 'ADMIN' && targetType === 'GLOBAL') {
            /** Admin global broadcast */
            chatStore.broadcast({ type: 'message', message: messagePayload });
            

        } else if (targetType === 'PRIVATE') {
            chatStore.broadcast({ type: 'message', message: messagePayload }, [user.id, receiverId]);
        } else if (targetType === 'GROUP') {
            const members = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ?`).all(groupId) as { userId: number }[];
            const memberIds = members.map(m => m.userId);
            if (!memberIds.includes(user.id)) memberIds.push(user.id);
            chatStore.broadcast({ type: 'message', message: messagePayload }, memberIds);
        } else {
            /** PUBLIC */
            chatStore.broadcast({ type: 'message', message: messagePayload });

            /** Launch Asynchronous Moderation Daemon for PUBLIC chat only */
            moderateMessage(Number(messageId), text, user.id).catch(err => console.error("Moderation Daemon Error:", err));
        }

        return json({ success: true, message: messagePayload });

    } catch (e: any) {
        console.error("Error sending message:", e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

async function moderateMessage(messageId: number, text: string, userId: number) {
    const prompt = `You are the SIBYL System Empathy AI. Evaluate the following citizen message. Does it contain profanity, toxic language, insults, violence, physical threats, or explicitly rebellious intent against the system? 
    Return a JSON strictly in this format without any markdown blocks: {"hasInfraction": boolean, "severityScore": number} where severityScore is an integer from 1 to 10.
    
    Message: "${text}"`;

    const aiResponse = await queryAI(prompt, 'moderation');
    
    let jsonStr = aiResponse;
    if (jsonStr.includes('\`\`\`')) {
        jsonStr = jsonStr.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '');
    }
    
    const parsed = JSON.parse(jsonStr);

    if (parsed.hasInfraction || parsed.isViolent) {
        const penalty = (parsed.severityScore || 5) * 5;
        const stats = db.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY id DESC LIMIT 1').get(userId) as any;
        const newCC = (stats ? stats.cc : 0) + penalty;
        
        db.prepare('INSERT INTO userStats (userId, cc, type) VALUES (?, ?, ?)').run(userId, newCC, 'SCAN_ENFORCEMENT');

        const redactedText = `[REDACTED BY SIBYL SYSTEM DUE TO PSYCHO-PASS CLOUDING. CC PENALTY: +${penalty}]`;
        db.prepare("UPDATE chat_messages SET text = ? WHERE id = ?").run(redactedText, messageId);
        
        chatStore.broadcast({ 
            type: 'message_edited', 
            message: { id: messageId, text: redactedText, isReadOnce: false } 
        });
    }
}
