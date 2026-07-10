import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getSession } from '$lib/server/session';

export async function GET({ cookies }) {
    const session = getSession(cookies.get('session'));
    if (!session) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.userId;

    try {
        const user = db.prepare('SELECT credits, role, last_login_date FROM users WHERE id = ?').get(userId) as { credits: number, role: string, last_login_date: string };
        const today = new Date().toISOString().split('T')[0];
        const hasClaimedDaily = user.last_login_date === today;
        const cosmetics = db.prepare('SELECT id, type, name, price, value, description FROM cosmetics').all();
        
        const userInventory = db.prepare(`
            SELECT uc.cosmeticId, uc.equipped 
            FROM user_cosmetics uc 
            WHERE uc.userId = ?
        `).all(userId);

        return json({
            success: true,
            credits: user.credits,
            role: user.role,
            hasClaimedDaily,
            cosmetics,
            inventory: userInventory
        });
    } catch (e) {
        console.error('Failed to fetch shop data:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
