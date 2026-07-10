import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';

/**
 * Handles the POST request to redeem a promotional code.
 * 
 * Validates the provided code, ensures it hasn't reached its usage limit,
 * and checks that the user hasn't already redeemed it. A `promo_usage`
 * table is maintained dynamically to prevent duplicate redemptions.
 * Upon successful validation, the user's credits are incremented.
 * 
 * @param {object} context - The request context.
 * @param {Request} context.request - The incoming HTTP request.
 * @param {Cookies} context.cookies - The request cookies for session extraction.
 * @returns {Promise<Response>} The JSON response indicating success or an error.
 */
export async function POST({ request, cookies }) {
    const session = getSession(cookies.get('session'));
    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    try {
        const { code } = await request.json();

        if (!code || typeof code !== 'string') {
            return json({ error: 'Invalid promo code' }, { status: 400 });
        }

        const promo = db.prepare('SELECT id, credits_reward, max_uses, current_uses FROM promo_codes WHERE code = ?').get(code) as any;

        if (!promo) {
            return json({ error: 'Promo code not found or invalid' }, { status: 404 });
        }

        if (promo.current_uses >= promo.max_uses) {
            return json({ error: 'Promo code has reached its maximum usage limit' }, { status: 400 });
        }

        db.exec(`
            CREATE TABLE IF NOT EXISTS promo_usage (
                userId INTEGER,
                promoId INTEGER,
                PRIMARY KEY (userId, promoId)
            )
        `);

        const alreadyUsed = db.prepare('SELECT 1 FROM promo_usage WHERE userId = ? AND promoId = ?').get(userId, promo.id);
        if (alreadyUsed) {
            return json({ error: 'You have already redeemed this promo code' }, { status: 400 });
        }

        db.prepare('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?').run(promo.id);
        db.prepare('INSERT INTO promo_usage (userId, promoId) VALUES (?, ?)').run(userId, promo.id);
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(promo.credits_reward, userId);

        return json({ success: true, reward: promo.credits_reward, message: `Promo code redeemed! +${promo.credits_reward} Credits.` });

    } catch (e) {
        console.error('Failed to redeem promo code:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
