import { fail, redirect } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { z } from 'zod';
import type { PageServerLoad, Actions } from './$types';

const CreateGroupSchema = z.object({
    name: z.string().min(1, 'Group name required').max(50, 'Group name must be 50 characters or less'),
    maxCC: z.coerce.number().min(0).max(999).default(100)
});

export const load: PageServerLoad = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) {
        throw redirect(303, '/auth');
    }

    const groups = db.prepare(`
        SELECT g.*, 
               (SELECT COUNT(*) FROM chat_group_members WHERE groupId = g.id) as memberCount,
               (SELECT 1 FROM chat_group_members WHERE groupId = g.id AND userId = ?) as isMember
        FROM chat_groups g
    `).all(user.id) as any[];

    const requests = db.prepare(`
        SELECT r.id, r.groupId, r.senderId, r.created_at,
               g.name as groupName, g.maxCC,
               u.username as senderName
        FROM group_requests r
        JOIN chat_groups g ON r.groupId = g.id
        JOIN users u ON r.senderId = u.id
        WHERE r.userId = ? AND r.status = 'PENDING'
    `).all(user.id) as any[];

    return {
        groups: groups.map(g => ({ ...g, isMember: Boolean(g.isMember) })),
        pendingRequests: requests
    };
};

export const actions: Actions = {
    create: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session')) as any;
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const payload = Object.fromEntries(formData);
        const result = CreateGroupSchema.safeParse(payload);

        if (!result.success) {
            return fail(400, { error: result.error.errors[0].message });
        }

        const { name, maxCC } = result.data;

        const stats = db.prepare(`SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1`).get(user.id) as any;
        const currentCC = stats ? stats.cc : 0;

        const existingMembership = db.prepare(`SELECT 1 FROM chat_group_members WHERE userId = ?`).get(user.id);
        if (existingMembership) {
            return fail(403, { error: 'You are already a member of a division.' });
        }

        if (user.role !== 'ADMIN' && currentCC > maxCC) {
            return fail(403, { error: 'Your CC exceeds the max CC you are trying to set' });
        }

        const insertGroup = db.prepare(`INSERT INTO chat_groups (name, maxCC, inspectorId) VALUES (?, ?, ?)`);
        const info = insertGroup.run(name, maxCC, user.id);
        const groupId = info.lastInsertRowid;

        db.prepare(`INSERT INTO chat_group_members (groupId, userId, role) VALUES (?, ?, 'CITIZEN')`).run(groupId, user.id);

        return { success: true, message: `Group [${name}] created successfully!` };
    },

    join: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session')) as any;
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const groupId = Number(formData.get('groupId'));

        const stats = db.prepare(`SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1`).get(user.id) as any;
        const currentCC = stats ? stats.cc : 0;

        const group = db.prepare(`SELECT * FROM chat_groups WHERE id = ?`).get(groupId) as any;
        if (!group) return fail(404, { error: 'Group not found' });

        if (user.role !== 'ADMIN' && currentCC > group.maxCC) {
            return fail(403, { error: `Access Denied: Your Crime Coefficient (${Math.round(currentCC)}) exceeds the group threshold (${group.maxCC}).` });
        }

        const existingMembership = db.prepare(`SELECT 1 FROM chat_group_members WHERE userId = ?`).get(user.id);
        if (existingMembership) {
            return fail(403, { error: 'You are already a member of a division.' });
        }

        try {
            db.prepare(`INSERT INTO chat_group_members (groupId, userId) VALUES (?, ?)`).run(groupId, user.id);
        } catch (e: any) {
            if (e.message.includes('UNIQUE constraint')) {
                return fail(400, { error: 'Already a member' });
            }
            return fail(500, { error: 'Server error' });
        }

        return { success: true, message: 'Successfully joined division' };
    },

    handleRequest: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session')) as any;
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const requestId = Number(formData.get('requestId'));
        const action = formData.get('action');

        if (!requestId || !['ACCEPT', 'DECLINE'].includes(action as string)) {
            return fail(400, { error: 'Invalid parameters' });
        }

        const req = db.prepare('SELECT * FROM group_requests WHERE id = ? AND userId = ? AND status = ?').get(requestId, user.id, 'PENDING') as any;
        if (!req) return fail(404, { error: 'Request not found' });

        if (action === 'DECLINE') {
            db.prepare('UPDATE group_requests SET status = ? WHERE id = ?').run('DECLINED', requestId);
            return { success: true, message: 'Request declined' };
        }

        const existingMembership = db.prepare('SELECT 1 FROM chat_group_members WHERE userId = ?').get(user.id);
        if (existingMembership) {
            return fail(400, { error: 'You are already a member of a division. Leave it first.' });
        }

        const stats = db.prepare('SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1').get(user.id) as any;
        const currentCC = stats ? stats.cc : 0;
        const group = db.prepare('SELECT maxCC FROM chat_groups WHERE id = ?').get(req.groupId) as any;
        
        if (user.role !== 'ADMIN' && group && currentCC > group.maxCC) {
            return fail(403, { error: 'Your Crime Coefficient exceeds the division limit.' });
        }

        try {
            db.prepare('INSERT INTO chat_group_members (groupId, userId) VALUES (?, ?)').run(req.groupId, user.id);
            db.prepare('UPDATE group_requests SET status = ? WHERE id = ?').run('ACCEPTED', requestId);
        } catch (e: any) {
            return fail(500, { error: 'Server error adding member' });
        }

        return { success: true, message: 'Successfully joined division' };
    }
};
