import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import { z } from 'zod';
import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user)
		return { credits: 0, role: 'CITIZEN', hasClaimedDaily: false, cosmetics: [], inventory: [] };

	try {
		const dbUser = db
			.prepare('SELECT credits, role, last_login_date FROM users WHERE id = ?')
			.get(user.id) as any;
		const today = new Date().toISOString().split('T')[0];
		const hasClaimedDaily = dbUser.last_login_date === today;
		const cosmetics = db
			.prepare('SELECT id, type, name, price, value, description FROM cosmetics')
			.all();

		const inventory = db
			.prepare(
				`
            SELECT uc.cosmeticId, uc.equipped 
            FROM user_cosmetics uc 
            WHERE uc.userId = ?
        `
			)
			.all(user.id);

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

		const cosmetic = db
			.prepare('SELECT type, price FROM cosmetics WHERE id = ?')
			.get(cosmeticId) as any;
		if (!cosmetic) return fail(404, { error: 'Cosmetic not found' });

		const ownsItem = db
			.prepare('SELECT id FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?')
			.get(user.id, cosmeticId);
		if (ownsItem) return fail(400, { error: 'Item already owned' });

		const dbUser = db.prepare('SELECT credits FROM users WHERE id = ?').get(user.id) as any;
		if (dbUser.credits < cosmetic.price) return fail(400, { error: 'Insufficient credits' });

		try {
			db.transaction(() => {
				const charged = db
					.prepare(
						`
                    UPDATE users SET credits = credits - ? WHERE id = ? AND credits >= ?
                `
					)
					.run(cosmetic.price, user.id, cosmetic.price);
				if (charged.changes === 0) throw new Error('INSUFFICIENT_CREDITS');
				db.prepare(
					'INSERT INTO user_cosmetics (userId, cosmeticId, equipped) VALUES (?, ?, 0)'
				).run(user.id, cosmeticId);
			})();
		} catch (e: any) {
			if (e?.message === 'INSUFFICIENT_CREDITS')
				return fail(400, { error: 'Insufficient credits' });
			if (String(e?.message).includes('UNIQUE constraint'))
				return fail(400, { error: 'Item already owned' });
			console.error('Purchase error:', e);
			return fail(500, { error: 'Server error' });
		}

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

		if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
			return fail(400, { error: 'Promo code usage limit reached' });
		}

		const used = db
			.prepare('SELECT id FROM promo_usage WHERE userId = ? AND promoId = ?')
			.get(user.id, promo.id);
		if (used) return fail(400, { error: 'You have already redeemed this code' });

		try {
			db.transaction(() => {
				const updated = db
					.prepare(
						`
                    UPDATE promo_codes
                    SET current_uses = current_uses + 1
                    WHERE id = ? AND (max_uses IS NULL OR current_uses < max_uses)
                `
					)
					.run(promo.id);

				if (updated.changes === 0) {
					throw new Error('PROMO_EXHAUSTED');
				}

				db.prepare('INSERT INTO promo_usage (userId, promoId) VALUES (?, ?)').run(
					user.id,
					promo.id
				);
				db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(
					Math.max(0, Number(promo.credits_reward) || 0),
					user.id
				);
			})();
		} catch (e: any) {
			if (e?.message === 'PROMO_EXHAUSTED' || String(e?.message).includes('UNIQUE constraint')) {
				return fail(400, { error: 'Promo code is no longer available' });
			}
			console.error('Promo redeem error:', e);
			return fail(500, { error: 'Server error' });
		}

		return { success: true, message: 'Promo code redeemed successfully' };
	},

	daily: async ({ cookies }) => {
		const user = getAuthUser(cookies.get('session'));
		if (!user) return fail(401, { error: 'Unauthorized' });

		const today = new Date().toISOString().split('T')[0];
		const reward = 50;

		const result = db
			.prepare(
				`
            UPDATE users
            SET credits = credits + ?, last_login_date = ?
            WHERE id = ? AND (last_login_date IS NULL OR last_login_date != ?)
        `
			)
			.run(reward, today, user.id, today);

		if (result.changes === 0) {
			return fail(400, { error: 'Already claimed today' });
		}

		return { success: true, message: `Claimed ${reward} credits` };
	}
};
