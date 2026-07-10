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
        const { action, cosmeticId } = await request.json();

        if (!cosmeticId || !action) {
            return json({ error: 'Invalid request payload' }, { status: 400 });
        }

        const cosmetic = db.prepare('SELECT type, price FROM cosmetics WHERE id = ?').get(cosmeticId) as { type: string, price: number } | undefined;
        
        if (!cosmetic) {
            return json({ error: 'Cosmetic not found' }, { status: 404 });
        }

        const ownsItem = db.prepare('SELECT id, equipped FROM user_cosmetics WHERE userId = ? AND cosmeticId = ?').get(userId, cosmeticId) as any;

        if (action === 'buy') {
            if (ownsItem) {
                return json({ error: 'Item already owned' }, { status: 400 });
            }

            const user = db.prepare('SELECT credits FROM users WHERE id = ?').get(userId) as { credits: number };
            if (user.credits < cosmetic.price) {
                return json({ error: 'Insufficient credits' }, { status: 400 });
            }

            /**
             * Deducts the cosmetic price from the user's credits and adds the cosmetic to their inventory.
             */
            db.prepare('UPDATE users SET credits = credits - ? WHERE id = ?').run(cosmetic.price, userId);
            db.prepare('INSERT INTO user_cosmetics (userId, cosmeticId, equipped) VALUES (?, ?, 0)').run(userId, cosmeticId);

            return json({ success: true, message: 'Item purchased successfully' });

        } else if (action === 'equip') {
            if (!ownsItem) {
                return json({ error: 'You do not own this item' }, { status: 400 });
            }

            /**
             * Unequips all other items of the same type for this user to ensure only one item of a type is equipped at a time.
             */
            const itemsOfType = db.prepare(`
                SELECT uc.id 
                FROM user_cosmetics uc 
                JOIN cosmetics c ON uc.cosmeticId = c.id 
                WHERE uc.userId = ? AND c.type = ?
            `).all(userId, cosmetic.type) as { id: number }[];

            if (itemsOfType.length > 0) {
                const ids = itemsOfType.map(i => i.id).join(',');
                db.prepare(`UPDATE user_cosmetics SET equipped = 0 WHERE id IN (${ids})`).run();
            }

            /**
             * Equips the requested item by setting its equipped status to 1.
             */
            db.prepare('UPDATE user_cosmetics SET equipped = 1 WHERE userId = ? AND cosmeticId = ?').run(userId, cosmeticId);

            return json({ success: true, message: 'Item equipped' });

        } else if (action === 'unequip') {
            if (!ownsItem) {
                return json({ error: 'You do not own this item' }, { status: 400 });
            }

            db.prepare('UPDATE user_cosmetics SET equipped = 0 WHERE userId = ? AND cosmeticId = ?').run(userId, cosmeticId);
            return json({ success: true, message: 'Item unequipped' });
            
        } else {
            return json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (e) {
        console.error('Failed to perform shop action:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
