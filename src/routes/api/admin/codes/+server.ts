import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

export async function GET({ cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user || user.role !== 'ADMIN') {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const codes = db.prepare(`
            SELECT p.*, u.username as creatorName 
            FROM promo_codes p 
            LEFT JOIN users u ON p.created_by = u.id 
            ORDER BY p.created_at DESC
        `).all();
        return json({ success: true, codes });
    } catch (e) {
        console.error('Failed to fetch promo codes:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST({ request, cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user || user.role !== 'ADMIN') {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }
    const sessionId = user.id;

    try {
        const { code, credits_reward, max_uses } = await request.json();

        if (!code || !credits_reward || !max_uses) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        db.prepare('INSERT INTO promo_codes (code, credits_reward, max_uses, created_by) VALUES (?, ?, ?, ?)').run(code, credits_reward, max_uses, sessionId);

        return json({ success: true, message: 'Promo code created successfully' });
    } catch (e: any) {
        if (e.message && e.message.includes('UNIQUE constraint failed')) {
            return json({ error: 'A promo code with this name already exists' }, { status: 400 });
        }
        console.error('Failed to create promo code:', e);
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT({ request, cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user || user.role !== 'ADMIN') return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id, code, credits_reward, max_uses } = await request.json();

        if (!id || !code || !credits_reward || !max_uses) {
            return json({ error: 'Missing required fields' }, { status: 400 });
        }

        db.prepare('UPDATE promo_codes SET code = ?, credits_reward = ?, max_uses = ? WHERE id = ?').run(code, credits_reward, max_uses, id);

        return json({ success: true, message: 'Promo code updated successfully' });
    } catch (e: any) {
        if (e.message && e.message.includes('UNIQUE constraint failed')) {
            return json({ error: 'A promo code with this name already exists' }, { status: 400 });
        }
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE({ request, cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user || user.role !== 'ADMIN') return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { id } = await request.json();
        if (!id) return json({ error: 'Missing code ID' }, { status: 400 });

        db.prepare('DELETE FROM promo_codes WHERE id = ?').run(id);
        return json({ success: true, message: 'Promo code deleted' });
    } catch (e) {
        return json({ error: 'Internal server error' }, { status: 500 });
    }
}
