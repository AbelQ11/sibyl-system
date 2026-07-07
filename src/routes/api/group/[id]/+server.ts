import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);

        const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        /** Calculate average CC and get roster */
        const roster = db.prepare(`
            SELECT m.role, u.id, u.username, u.avatar, u.citizen_id,
                   (SELECT cc FROM userStats WHERE userId = u.id ORDER BY created_at DESC LIMIT 1) as cc
            FROM chat_group_members m
            JOIN users u ON m.userId = u.id
            WHERE m.groupId = ?
        `).all(groupId) as any[];

        const validCCs = roster.map(r => r.cc).filter(cc => cc !== null && cc !== undefined);
        const avgCC = validCCs.length > 0 ? (validCCs.reduce((a, b) => a + b, 0) / validCCs.length).toFixed(1) : 0;

        return json({
            group,
            roster,
            avgCC
        });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);
        const { bio, maxCC, name } = await request.json();

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) {
            return json({ error: 'Only the Division Inspector can update these settings' }, { status: 403 });
        }

        if (name && name.length > 50) {
            return json({ error: 'Group name must be 50 characters or less' }, { status: 400 });
        }

        const newName = name || group.name;

        db.prepare('UPDATE chat_groups SET bio = ?, maxCC = ?, name = ? WHERE id = ?').run(bio, maxCC, newName, groupId);

        return json({ success: true });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async ({ params, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groupId = parseInt(params.id);

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return json({ error: 'Division not found' }, { status: 404 });

        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) {
            return json({ error: 'Only the Division Inspector can disband the division' }, { status: 403 });
        }

        const transaction = db.transaction(() => {
            /** Delete pending requests */
            db.prepare('DELETE FROM group_requests WHERE groupId = ?').run(groupId);
            /** Delete members */
            db.prepare('DELETE FROM chat_group_members WHERE groupId = ?').run(groupId);
            /** Delete messages */
            db.prepare('DELETE FROM chat_messages WHERE targetGroupId = ?').run(groupId);
            /** Delete the group */
            db.prepare('DELETE FROM chat_groups WHERE id = ?').run(groupId);
        });

        transaction();

        return json({ success: true, message: 'Division disbanded successfully' });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
