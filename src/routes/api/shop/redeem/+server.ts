import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';

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

        // Ideally, we should also track WHICH users redeemed the code so they can't redeem it twice.
        // I will add a simple check: if we had a promo_usage table.
        // For now, I'll allow simple logic without per-user restriction or just assume single-use codes for now,
        // Wait, the plan didn't specify a user_promo_codes table. Let's just create one on the fly here to be safe.
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

        // Apply reward
        db.prepare('UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?').run(promo.id);
        db.prepare('INSERT INTO promo_usage (userId, promoId) VALUES (?, ?)').run(userId, promo.id);
        db.prepare('UPDATE users SET credits = credits + ? WHERE id = ?').run(promo.credits_reward, userId);

        return json({ success: true, reward: promo.credits_reward, message: `Promo code redeemed! +${promo.credits_reward} Credits.` });

    } catch (e) {
        console.error('Failed to redeem promo code:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
