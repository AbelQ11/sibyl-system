import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { z } from 'zod';
import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return { group: null, roster: [], avgCC: '0.0', friends: [], pendingGroupRequests: [] };

    try {
        const groupId = parseInt(params.id);

        const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return { error: 'Division not found' };

        const roster = db.prepare(`
            SELECT m.role, u.id, u.username, u.avatar, u.citizen_id,
                   (SELECT cc FROM userStats WHERE userId = u.id ORDER BY created_at DESC LIMIT 1) as cc
            FROM chat_group_members m
            JOIN users u ON m.userId = u.id
            WHERE m.groupId = ?
        `).all(groupId) as any[];

        const validCCs = roster.map(r => r.cc).filter(cc => cc !== null && cc !== undefined);
        const avgCC = validCCs.length > 0 ? (validCCs.reduce((a, b) => a + b, 0) / validCCs.length).toFixed(1) : '0.0';

        let friends = [];
        try {
            if (user.role === 'ADMIN') {
                friends = db.prepare(`SELECT id, username, avatar FROM users WHERE id != ?`).all(user.id) as any[];
            } else {
                friends = db.prepare(`
                    SELECT u.id, u.username, u.avatar
                    FROM users u
                    LEFT JOIN friend_requests r ON (r.receiverId = u.id AND r.senderId = ?) OR (r.senderId = u.id AND r.receiverId = ?)
                    WHERE (r.status = 'ACCEPTED' OR u.role = 'ADMIN') AND u.id != ?
                `).all(user.id, user.id, user.id) as any[];
            }
        } catch(e) {}

        let pendingGroupRequests = [];
        if (user.role === 'ADMIN' || user.id === group.inspectorId) {
            try {
                pendingGroupRequests = db.prepare(`
                    SELECT r.id as requestId, u.id as userId, u.username, u.avatar, u.citizen_id
                    FROM users u
                    JOIN group_requests r ON r.userId = u.id
                    WHERE r.groupId = ? AND r.status = 'PENDING'
                `).all(groupId) as any[];
            } catch (e) {}
        }

        return {
            group,
            roster,
            avgCC,
            friends,
            pendingGroupRequests
        };
    } catch (err) {
        console.error('Failed to load group details:', err);
        return { error: 'Failed to load group data' };
    }
};

const saveSettingsSchema = z.object({
    bio: z.string().max(255).optional(),
    maxCC: z.coerce.number().min(0).max(1000).optional(),
    name: z.string().max(50).optional()
});

const idSchema = z.object({
    id: z.coerce.number()
});

const changeRoleSchema = z.object({
    targetUserId: z.coerce.number(),
    action: z.enum(['PROMOTE', 'DEMOTE'])
});

const avatarSchema = z.object({
    avatar: z.string().min(1)
});

export const actions: Actions = {
    saveSettings: async ({ request, params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = saveSettingsSchema.safeParse(Object.fromEntries(formData));
        if (!parseResult.success) return fail(400, { error: 'Invalid settings' });

        const groupId = parseInt(params.id);
        const { bio, maxCC, name } = parseResult.data;

        const group = db.prepare('SELECT inspectorId, name FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return fail(404, { error: 'Division not found' });
        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) return fail(403, { error: 'Only Inspector can edit' });

        const newName = name || group.name;
        db.prepare('UPDATE chat_groups SET bio = ?, maxCC = ?, name = ? WHERE id = ?').run(bio, maxCC, newName, groupId);

        return { success: true, message: 'Settings saved' };
    },

    disband: async ({ params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const groupId = parseInt(params.id);
        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return fail(404, { error: 'Division not found' });
        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) return fail(403, { error: 'Only Inspector can disband' });

        const transaction = db.transaction(() => {
            db.prepare('DELETE FROM group_requests WHERE groupId = ?').run(groupId);
            db.prepare('DELETE FROM chat_group_members WHERE groupId = ?').run(groupId);
            db.prepare('DELETE FROM chat_messages WHERE groupId = ?').run(groupId);
            db.prepare('DELETE FROM chat_groups WHERE id = ?').run(groupId);
        });
        transaction();
        
        throw redirect(303, '/groups');
    },

    inviteFriend: async ({ request, params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = idSchema.safeParse({ id: formData.get('friendId') });
        if (!parseResult.success) return fail(400, { error: 'Invalid friend ID' });

        const friendId = parseResult.data.id;
        const groupId = parseInt(params.id);

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return fail(404, { error: 'Division not found' });

        const existing = db.prepare('SELECT id FROM chat_group_members WHERE groupId = ? AND userId = ?').get(groupId, friendId);
        if (existing) return fail(400, { error: 'User is already a member' });

        db.prepare('INSERT INTO chat_group_members (groupId, userId, role) VALUES (?, ?, ?)').run(groupId, friendId, 'CITIZEN');

        return { success: true, message: 'User invited successfully' };
    },

    uploadAvatar: async ({ request, params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = avatarSchema.safeParse({ avatar: formData.get('avatar') });
        if (!parseResult.success) return fail(400, { error: 'Invalid avatar data' });

        const groupId = parseInt(params.id);
        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return fail(404, { error: 'Division not found' });
        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) return fail(403, { error: 'Unauthorized' });

        db.prepare('UPDATE chat_groups SET avatar = ? WHERE id = ?').run(parseResult.data.avatar, groupId);
        return { success: true, message: 'Avatar updated' };
    },

    changeRole: async ({ request, params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = changeRoleSchema.safeParse(Object.fromEntries(formData));
        if (!parseResult.success) return fail(400, { error: 'Invalid role data' });

        const groupId = parseInt(params.id);
        const { targetUserId, action } = parseResult.data;

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return fail(404, { error: 'Division not found' });
        if (user.role !== 'ADMIN' && group.inspectorId !== user.id) return fail(403, { error: 'Unauthorized' });
        if (group.inspectorId === targetUserId) return fail(403, { error: 'Cannot modify Inspector' });

        const newRole = action === 'PROMOTE' ? 'ENFORCER' : 'CITIZEN';
        db.prepare('UPDATE chat_group_members SET role = ? WHERE groupId = ? AND userId = ?').run(newRole, groupId, targetUserId);

        return { success: true, message: 'Role updated' };
    },

    kickMember: async ({ request, params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = idSchema.safeParse({ id: formData.get('targetUserId') });
        if (!parseResult.success) return fail(400, { error: 'Invalid member ID' });

        const targetUserId = parseResult.data.id;
        const groupId = parseInt(params.id);

        const group = db.prepare('SELECT inspectorId FROM chat_groups WHERE id = ?').get(groupId) as any;
        if (!group) return fail(404, { error: 'Division not found' });
        
        const currentUserMember = db.prepare('SELECT role FROM chat_group_members WHERE groupId = ? AND userId = ?').get(groupId, user.id) as any;
        
        let canKick = false;
        if (user.role === 'ADMIN' || group.inspectorId === user.id || user.id === targetUserId) {
            canKick = true;
        } else if (currentUserMember?.role === 'ENFORCER' && targetUserId !== group.inspectorId) {
            canKick = true;
        }

        if (!canKick) return fail(403, { error: 'Insufficient permissions' });
        if (group.inspectorId === targetUserId) return fail(403, { error: 'Cannot kick Inspector' });

        db.prepare('DELETE FROM chat_group_members WHERE groupId = ? AND userId = ?').run(groupId, targetUserId);

        return { success: true, message: 'Member kicked' };
    },

    revokeInvite: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = idSchema.safeParse({ id: formData.get('requestId') });
        if (!parseResult.success) return fail(400, { error: 'Invalid request ID' });

        db.prepare('DELETE FROM group_requests WHERE id = ?').run(parseResult.data.id);
        return { success: true, message: 'Invite revoked' };
    },

    joinGroup: async ({ params, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const groupId = parseInt(params.id);
        
        const existing = db.prepare('SELECT id FROM chat_group_members WHERE groupId = ? AND userId = ?').get(groupId, user.id);
        if (existing) return fail(400, { error: 'Already a member' });

        const reqExists = db.prepare('SELECT id FROM group_requests WHERE groupId = ? AND userId = ? AND status = ?').get(groupId, user.id, 'PENDING');
        if (reqExists) return fail(400, { error: 'Request already pending' });

        db.prepare('INSERT INTO group_requests (groupId, userId, status) VALUES (?, ?, ?)').run(groupId, user.id, 'PENDING');
        return { success: true, message: 'Join request sent' };
    }
};
