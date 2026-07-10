import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    const session = getSession(cookies.get('session'));
    if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const userId = session.userId;
        
        const requests = db.prepare(`
            SELECT r.id, r.groupId, r.senderId, r.created_at,
                   g.name as groupName, g.maxCC,
                   u.username as senderName
            FROM group_requests r
            JOIN chat_groups g ON r.groupId = g.id
            JOIN users u ON r.senderId = u.id
            WHERE r.userId = ? AND r.status = 'PENDING'
        `).all(userId) as any[];

        return json({ requests });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ request, cookies }) => {
    const session = getSession(cookies.get('session'));
    if (!session) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const userId = session.userId;

        const { requestId, action } = await request.json();

        if (!requestId || !['ACCEPT', 'DECLINE'].includes(action)) {
            return json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const req = db.prepare('SELECT * FROM group_requests WHERE id = ? AND userId = ? AND status = ?').get(requestId, userId, 'PENDING') as any;
        if (!req) {
            return json({ error: 'Request not found or already processed' }, { status: 404 });
        }

        if (action === 'DECLINE') {
            db.prepare('UPDATE group_requests SET status = ? WHERE id = ?').run('DECLINED', requestId);
            return json({ success: true, message: 'Request declined' });
        }


        const existingMembership = db.prepare('SELECT 1 FROM chat_group_members WHERE userId = ?').get(userId);
        if (existingMembership) {

            return json({ error: 'You are already a member of a division. Leave it first before joining another.' }, { status: 400 });
        }


        const stats = db.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1').get(userId) as any;
        const currentCC = stats ? stats.cc : 0;

        const group = db.prepare('SELECT maxCC FROM chat_groups WHERE id = ?').get(req.groupId) as any;
        if (group && currentCC > group.maxCC) {
            return json({ error: `Your Crime Coefficient (${Math.round(currentCC)}) exceeds the group limit (${group.maxCC})` }, { status: 403 });
        }


        const transaction = db.transaction(() => {
            db.prepare('UPDATE group_requests SET status = ? WHERE id = ?').run('ACCEPTED', requestId);
            db.prepare('INSERT INTO chat_group_members (groupId, userId, role) VALUES (?, ?, ?)')
              .run(req.groupId, userId, 'CITIZEN');
        });

        transaction();

        return json({ success: true, message: 'Welcome to the division' });
    } catch (e: any) {
        if (e.message.includes('UNIQUE constraint')) {
            return json({ error: 'You are already in this division' }, { status: 400 });
        }
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
