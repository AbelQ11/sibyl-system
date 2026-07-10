import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
    const user = getAuthUser(cookies.get('session'));
    if (!user) return { credits: 0, role: 'CITIZEN', hasClaimedDaily: false, cosmetics: [], inventory: [] };

    try {
        const dbUser = db.prepare('SELECT credits, role, last_login_date FROM users WHERE id = ?').get(user.id) as any;
        const today = new Date().toISOString().split('T')[0];
        const hasClaimedDaily = dbUser.last_login_date === today;
        const cosmetics = db.prepare('SELECT id, type, name, price, value, description FROM cosmetics').all();
        
        const inventory = db.prepare(`
            SELECT uc.cosmeticId, uc.equipped 
            FROM user_cosmetics uc 
            WHERE uc.userId = ?
        `).all(user.id);

        return {
            credits: dbUser.credits,
            role: dbUser.role,
            hasClaimedDaily,
            cosmetics,
            inventory
        };
    } catch (err) {
        console.error('Failed to load shop data:', err);
        return { error: 'Failed to load shop data' };
    }
};

const idSchema = z.object({ id: z.coerce.number() });
const redeemSchema = z.object({ code: z.string().trim().min(1) });

export const actions: Actions = {
    buy: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = idSchema.safeParse({ id: formData.get('cosmeticId') });
        if (!parseResult.success) return fail(400, { error: 'Invalid cosmetic ID' });

        const cosmeticId = parseResult.data.id;

        const cosmetic = db.prepare('SELECT type, price FROM cosmetics WHERE id = ?').get(cosmeticId) as any;
        if (!cosmetic) return fail(404, { error: 'Cosmetic not found' });

        const ownsItem = db.prepare('SELECT id FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').get(user.id, cosmeticId);
        if (ownsItem) return fail(400, { error: 'Item already owned' });

        const dbUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id) as any;
        if (dbUser.credits < cosmetic.price) return fail(400, { error: 'Insufficient credits' });

        db.transaction(() => {
            db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(cosmetic.price, user.id);
            db.prepare('INSERT INTO user_cosmetics (userId, cosmeticId, equipped) VALUES (?, ?, 0)').run(user.id, cosmeticId);
        })();

        return { success: true, message: 'Item purchased successfully' };
    },

    redeem: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const formData = await request.formData();
        const parseResult = redeemSchema.safeParse({ code: formData.get('code') });
        if (!parseResult.success) return fail(400, { error: 'Invalid code' });

        const codeStr = parseResult.data.code.toUpperCase();

        const promo = db.prepare('SELECT * FROM promo_codes WHERE code = ?').get(codeStr) as any;
        if (!promo) return fail(400, { error: 'Invalid or expired promo code' });

        if (promo.expires_at && new Date() > new Date(promo.expires_at)) {
            return fail(400, { error: 'Promo code has expired' });
        }
        if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
            return fail(400, { error: 'Promo code usage limit reached' });
        }

        const used = db.prepare('SELECT id FROM user_promo_codes WHERE userId = ? AND promoId = ?').get(user.id, promo.id);
        if (used) return fail(400, { error: 'You have already redeemed this code' });

        db.transaction(() => {
            db.prepare('UPDATE promo_codes SET uses = uses + 1 WHERE id = ?').run(promo.id);
            db.prepare('INSERT INTO user_promo_codes (userId, promoId) VALUES (?, ?)').run(user.id, promo.id);

            if (promo.reward_type === 'CREDITS') {
                db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(promo.reward_amount, user.id);
            } else if (promo.reward_type === 'COSMETIC') {
                const ownsItem = db.prepare('SELECT id FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').get(user.id, promo.reward_amount);
                if (!ownsItem) {
                    db.prepare('INSERT INTO user_cosmetics (userId, cosmeticId, equipped) VALUES (?, ?, 0)').run(user.id, promo.reward_amount);
                }
            }
        })();

        return { success: true, message: 'Promo code redeemed successfully' };
    },

    daily: async ({ cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) return fail(401, { error: 'Unauthorized' });

        const dbUser = db.prepare('SELECT last_login_date FROM users WHERE id = ?').get(user.id) as any;
        const today = new Date().toISOString().split('T')[0];

        if (dbUser.last_login_date === today) {
            return fail(400, { error: 'Already claimed today' });
        }

        const reward = 50;
        db.prepare('UPDATE users SET credits = credits + ?, last_login_date = ? WHERE id = ?').run(reward, today, user.id);

        return { success: true, message: `Claimed ${reward} credits` };
    }
};
