import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const groups = db.prepare(`
            SELECT g.*, 
                   (SELECT COUNT(*) FROM chat_group_members WHERE groupId = g.id) as memberCount,
                   (SELECT 1 FROM chat_group_members WHERE groupId = g.id AND userId = ?) as isMember
            FROM chat_groups g
        `).all(user.id) as any[];

        return json({ groups: groups.map(g => ({ ...g, isMember: Boolean(g.isMember) })) });
    } catch (e: any) {
        return json({ error: e.message || 'Server error' }, { status: 500 });
    }
};

export const POST: RequestHandler = async ({ request, cookies }) => {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare(`SELECT id, role FROM users WHERE id = ?`).get(sessionId) as any;
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { action } = body;

        /** Get user's current CC */
        const stats = db.prepare(`SELECT cc FROM userStats WHERE userId = ? ORDER BY created_at DESC LIMIT 1`).get(user.id) as any;
        const currentCC = stats ? stats.cc : 0;

        if (action === 'CREATE') {
            const { name, maxCC } = body;
            if (!name) return json({ error: 'Group name required' }, { status: 400 });
            if (name.length > 50) return json({ error: 'Group name must be 50 characters or less' }, { status: 400 });

            /** Enforce single group rule */
            const existingMembership = db.prepare(`SELECT 1 FROM chat_group_members WHERE userId = ?`).get(user.id);
            if (existingMembership) {
                return json({ error: 'You are already a member of a division. You can only belong to one.' }, { status: 403 });
            }

            /** Admin bypasses CC checks, but for regular users creating groups: */
            if (user.role !== 'ADMIN' && currentCC > maxCC) {
                return json({ error: 'Your CC exceeds the max CC you are trying to set' }, { status: 403 });
            }

            const insertGroup = db.prepare(`INSERT INTO chat_groups (name, maxCC, inspectorId) VALUES (?, ?, ?)`);
            const info = insertGroup.run(name, maxCC || 100, user.id);
            const groupId = info.lastInsertRowid;

            /** Add creator as CITIZEN (they are implicitly Inspector via the inspectorId field) */
            db.prepare(`INSERT INTO chat_group_members (groupId, userId, role) VALUES (?, ?, 'CITIZEN')`).run(groupId, user.id);

            /** Webhook to create Discord role & channel */
            try {
                fetch('http://127.0.0.1:3005/webhook', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${env.SIB_BOT_SECRET}`
                    },
                    body: JSON.stringify({
                        action: 'CREATE_GROUP',
                        payload: { name }
                    })
                }).catch(console.error);
            } catch (e) {
                console.error("Webhook failed:", e);
            }

            return json({ success: true, groupId, name, maxCC });
        } 
        else if (action === 'JOIN') {
            const { groupId } = body;
            
            const group = db.prepare(`SELECT * FROM chat_groups WHERE id = ?`).get(groupId) as any;
            if (!group) return json({ error: 'Group not found' }, { status: 404 });

            if (user.role !== 'ADMIN' && currentCC > group.maxCC) {
                return json({ error: `Access Denied: Your Crime Coefficient (${Math.round(currentCC)}) exceeds the group threshold (${group.maxCC}).` }, { status: 403 });
            }

            /** Enforce single group rule */
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
