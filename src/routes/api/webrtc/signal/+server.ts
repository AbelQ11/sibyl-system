import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { chatStore } from '$lib/server/chatStore';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    
    if (!sessionId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = db.prepare(`
        SELECT id, username 
        FROM users 
        WHERE id = ?
    `).get(sessionId) as any;

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { targetId, targetGroupId, signalType, signalData } = body;

        if (!signalType || !signalData) {
            return json({ error: 'Missing signal data' }, { status: 400 });
        }

        /**
         * Broadcasts the WebRTC signal payload to the appropriate connected clients.
         * If a targetId is specified, the signal is routed directly to that specific user for a private connection.
         * If a targetGroupId is specified, the signal is broadcasted to all active members of the group, 
         * establishing a mesh network topology.
         */
        const payload = {
            type: 'webrtc_signal',
            senderId: user.id,
            senderName: user.username,
            signalType,
            signalData,
            targetGroupId
        };

        if (targetId) {
            /** 
             * P2P Private Call Route
             * Directs the WebRTC negotiation signal exclusively to the targeted user's SSE controller.
             */
            chatStore.broadcast(payload, [targetId]);
        } else if (targetGroupId) {
            /**
             * Mesh Network Group Route
             * Queries the database for all members belonging to the target group, excluding the sender,
             * and broadcasts the negotiation signal to their respective SSE controllers.
             */
            const members = db.prepare(`SELECT userId FROM chat_group_members WHERE groupId = ? AND userId != ?`).all(targetGroupId, user.id) as { userId: number }[];
            const memberIds = members.map(m => m.userId);
            if (memberIds.length > 0) {
                chatStore.broadcast(payload, memberIds);
            }
        }

        return json({ success: true });

    } catch (e: any) {
        console.error("Error sending WebRTC signal:", e);
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
