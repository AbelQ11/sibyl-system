import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import { getAuthUser } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        let query = `
            SELECT g.*, 
                   (SELECT COUNT(*) FROM chat_group_members WHERE groupId = g.id) as memberCount,
                   1 as isMember
            FROM chat_groups g
            JOIN chat_group_members cgm ON g.id = cgm.groupId
            WHERE cgm.userId = ?
        `;
        let params = [user.id];

        if (user.role === 'ADMIN') {
            query = `
                SELECT g.*, 
                       (SELECT COUNT(*) FROM chat_group_members WHERE groupId = g.id) as memberCount,
                       (SELECT 1 FROM chat_group_members WHERE groupId = g.id AND userId = ?) as isMember
                FROM chat_groups g
            `;
            params = [user.id];
        }

        const groups = db.prepare(query).all(...params) as any[];

        return json({ groups: groups.map(g => ({ ...g, isMember: Boolean(g.isMember) })) });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, cookies }) => {
    const user = getAuthUser(cookies.get('session')) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { action } = body;


        const stats = db.prepare(`SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1`).get(user.id) as any;
        const currentCC = stats ? stats.cc : 0;

        if (action === 'CREATE') {
            const { name, maxCC } = body;
            if (!name) return json({ error: 'Group name required' }, { status: 400 });
            if (name.length > 50) return json({ error: 'Group name must be 50 characters or less' }, { status: 400 });


            const existingMembership = db.prepare(`SELECT 1 FROM chat_group_members WHERE userId = ?`).get(user.id);
            if (existingMembership) {
                return json({ error: 'You are already a member of a division. You can only belong to one.' }, { status: 403 });
            }


            if (user.role !== 'ADMIN' && currentCC > maxCC) {
                return json({ error: 'Your CC exceeds the max CC you are trying to set' }, { status: 403 });
            }

            const insertGroup = db.prepare(`INSERT INTO chat_groups (name, maxCC, inspectorId) VALUES (?, ?, ?)`);
            const info = insertGroup.run(name, maxCC || 100, user.id);
            const groupId = info.lastInsertRowid;


            db.prepare(`INSERT INTO chat_group_members (groupId, userId, role) VALUES (?, ?, 'CITIZEN')`).run(groupId, user.id);



            return json({ success: true, groupId, name, maxCC });
        } 
        else if (action === 'JOIN') {
            const { groupId } = body;
            
            const group = db.prepare(`SELECT * FROM chat_groups WHERE id = ?`).get(groupId) as any;
            if (!group) return json({ error: 'Group not found' }, { status: 404 });

            if (user.role !== 'ADMIN' && currentCC > group.maxCC) {
                return json({ error: `Access Denied: Your Crime Coefficient (${Math.round(currentCC)}) exceeds the group threshold (${group.maxCC}).` }, { status: 403 });
            }


            const existingMembership = db.prepare(`SELECT 1 FROM chat_group_members WHERE userId = ?`).get(user.id);
            if (existingMembership) {
                return json({ error: 'You are already a member of a division. You can only belong to one.' }, { status: 403 });
            }

            try {
                db.prepare(`INSERT INTO chat_group_members (groupId, userId) VALUES (?, ?)`).run(groupId, user.id);
            } catch (e: any) {
                if (e.message.includes('UNIQUE constraint')) {
                    return json({ error: 'Already a member' }, { status: 400 });
                }
                throw e;
            }

            return json({ success: true, group });
        }

        return json({ error: 'Invalid action' }, { status: 400 });

    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};
