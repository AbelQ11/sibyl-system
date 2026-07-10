import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) {
            return json({ error: 'Only the Division Inspector can view pending invites' }, { status: 403 });
        }

        const requests = db.prepare(`
            SELECT r.id, r.userId, r.status, u.username, u.citizen_id
            FROM group_requests r
            JOIN users u ON r.userId = u.id
            WHERE r.groupId = ? AND r.status = 'PENDING'
        `).all(groupId);

        return json({ requests });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ params, request, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);
        const { requestId } = await request.json();

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) {
            return json({ error: 'Only the Division Inspector can revoke invites' }, { status: 403 });
        }

        db.prepare('DELETE FROM group_requests WHERE id = ? AND groupId = ? AND status = ?').run(requestId, groupId, 'PENDING');

        return json({ success: true, message: 'Invite revoked' });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
