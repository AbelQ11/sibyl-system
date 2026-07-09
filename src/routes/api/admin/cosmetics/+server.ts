import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export async function GET({ cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(sessionId) as { role: string };
    if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

    try {
        const cosmetics = db.prepare('SELECT * FROM cosmetics').all();
        return json({ success: true, cosmetics });
    } catch (e) {
        return json({ error: 'Failed to fetch cosmetics' }, { status: 500 });
    }
}

export async function POST({ request, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(sessionId) as { role: string };
    if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { type, name, price, value, description, css_rules } = await request.json();
        if (!type || !name || price == null || !value || !description) {
            return json({ error: 'Missing fields' }, { status: 400 });
        }

        const stmt = db.prepare('INSERT INTO cosmetics (type, name, price, value, description, css_rules) VALUES (?, ?, ?, ?, ?, ?)');
        stmt.run(type, name, price, value, description, css_rules || null);

        return json({ success: true, message: 'Cosmetic created successfully' });
    } catch (e) {
        console.error(e);
        return json({ error: 'Failed to create cosmetic' }, { status: 500 });
    }
}

export async function PUT({ request, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(sessionId) as { role: string };
    if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { id, type, name, price, value, description, css_rules } = await request.json();
        if (!id || !type || !name || price == null || !value || !description) {
            return json({ error: 'Missing fields' }, { status: 400 });
        }

        const stmt = db.prepare('UPDATE cosmetics SET type = ?, name = ?, price = ?, value = ?, description = ?, css_rules = ? WHERE id = ?');
        stmt.run(type, name, price, value, description, css_rules || null, id);

        return json({ success: true, message: 'Cosmetic updated successfully' });
    } catch (e) {
        console.error(e);
        return json({ error: 'Failed to update cosmetic' }, { status: 500 });
    }
}

export async function DELETE({ request, cookies }) {
    const sessionId = cookies.get('session');
    if (!sessionId) return json({ error: 'Unauthorized' }, { status: 401 });

    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(sessionId) as { role: string };
    if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

    try {
        const { id } = await request.json();
        if (!id) return json({ error: 'Missing cosmetic ID' }, { status: 400 });

        db.prepare('DELETE FROM cosmetics WHERE id = ?').run(id);
        return json({ success: true, message: 'Cosmetic deleted' });
    } catch (e) {
        return json({ error: 'Failed to delete cosmetic' }, { status: 500 });
    }
}
