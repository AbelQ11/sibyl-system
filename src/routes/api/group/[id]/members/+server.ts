import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

/** PROMOTE or DEMOTE */
export const PUT: RequestHandler = async ({ params, request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);
        /** action: 'PROMOTE' or 'DEMOTE' */
        const { targetUserId, action } = await request.json();

        if (!targetUserId || !['PROMOTE', 'DEMOTE'].includes(action)) {
            return json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) {
            return json({ error: 'Only the Division Inspector can modify member roles' }, { status: 403 });
        }

        if (group.inspectorId === targetUserId) {
            return json({ error: 'Cannot modify the Inspector role through this endpoint' }, { status: 403 });
        }

        const newRole = action === 'PROMOTE' ? 'ENFORCER' : 'CITIZEN';

        db.prepare('UPDATE chat_group_members SET role = ? WHERE groupId = ? AND userId = ?').run(newRole, groupId, targetUserId);

        return json({ success: true, message: `Member ${action === 'PROMOTE' ? 'promoted to ENFORCER' : 'demoted to CITIZEN'}` });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

/** KICK */
export const DELETE: RequestHandler = async ({ params, request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);
        const { targetUserId } = await request.json();

        if (!targetUserId) {
            return json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        const targetMember = db.prepare('SELECT role FROM chat_group_members WHERE groupId = ? AND userId = ?').get(groupId, targetUserId) as any;
        if (!targetMember) return json({ error: 'Target is not a member' }, { status: 404 });

        const currentUserGroupMember = db.prepare('SELECT role FROM chat_group_members WHERE groupId = ? AND userId = ?').get(groupId, user.id) as any;

        let canKick = false;
        if (user.role === 'ADMIN' || group.inspectorId === user.id || user.id === targetUserId) {
            canKick = true;
        } else if (currentUserGroupMember && currentUserGroupMember.role === 'ENFORCER') {
            if (targetUserId !== group.inspectorId) {
                canKick = true;
            }
        }

        if (!canKick) {
            return json({ error: 'Insufficient permissions to kick members' }, { status: 403 });
        }

        if (group.inspectorId === targetUserId) {
            return json({ error: 'The Inspector cannot be kicked from the division. Disband it instead.' }, { status: 403 });
        }

        db.prepare('DELETE FROM chat_group_members WHERE groupId = ? AND userId = ?').run(groupId, targetUserId);

        return json({ success: true, message: 'Member removed from division' });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
