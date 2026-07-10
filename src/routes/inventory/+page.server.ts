import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return { cosmetics: [], inventory: [] };

    try {
        const cosmetics = db.prepare('SELECT id, type, name, price, value, description FROM cosmetics').all();
        
        const inventory = db.prepare(`
            SELECT uc.cosmeticId, uc.equipped 
            FROM user_cosmetics uc 
            WHERE uc.userId = ?
        `).all(user.id);

        return {
            cosmetics,
            inventory
        };
    } catch (err) {
        console.error('Failed to load inventory data:', err);
        return { error: 'Failed to load inventory data' };
    }
};

const idSchema = z.object({ id: z.coerce.number() });

export const actions: Actions = {
    equip: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = idSchema.safeParse({ id: formData.get('cosmeticId') });
        if (!parseResult.success) return fail(400, { error: 'Invalid cosmetic ID' });

        const cosmeticId = parseResult.data.id;

        const cosmetic = db.prepare('SELECT type FROM cosmetics WHERE id = ?').get(cosmeticId) as any;
        if (!cosmetic) return fail(404, { error: 'Cosmetic not found' });

        const ownsItem = db.prepare('SELECT id FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').get(user.id, cosmeticId);
        if (!ownsItem) return fail(400, { error: 'You do not own this item' });

        const itemsOfType = db.prepare(`
            SELECT uc.id 
            FROM user_cosmetics uc 
            JOIN cosmetics c ON uc.cosmeticId = c.id 
            WHERE uc.userId = ? AND c.type = ?
        `).all(user.id, cosmetic.type) as { id: number }[];

        if (itemsOfType.length > 0) {
            const ids = itemsOfType.map(i => i.id).join(',');
            db.prepare(`UPDATE user_cosmetics SET equipped = 0 WHERE id IN (${ids})`).run();
        }

        db.prepare('UPDATE user_cosmetics SET equipped = 1 WHERE userId = ? AND cosmeticId = ?').run(user.id, cosmeticId);

        return { success: true, message: 'Item equipped', reload: cosmetic.type === 'interface_theme' || cosmetic.type === 'pointer_skin' };
    },

    unequip: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = idSchema.safeParse({ id: formData.get('cosmeticId') });
        if (!parseResult.success) return fail(400, { error: 'Invalid cosmetic ID' });

        const cosmeticId = parseResult.data.id;
        const ownsItem = db.prepare('SELECT id FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').get(user.id, cosmeticId);
        if (!ownsItem) return fail(400, { error: 'You do not own this item' });

        const cosmetic = db.prepare('SELECT type FROM cosmetics WHERE id = ?').get(cosmeticId) as any;

        db.prepare('UPDATE user_cosmetics SET equipped = 0 WHERE userId = ? AND cosmeticId = ?').run(user.id, cosmeticId);

        return { success: true, message: 'Item unequipped', reload: cosmetic?.type === 'interface_theme' || cosmetic?.type === 'pointer_skin' };
    }
};
