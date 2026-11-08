import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

function parsePromo(body: any) {
	const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : '';
	const credits = Number(body?.credits_reward);
	const maxUses = Number(body?.max_uses);

	if (!/^[A-Z0-9_-]{1,50}$/.test(code)) return { error: 'Invalid code.' };
	if (!Number.isInteger(credits) || credits < 0 || credits > 1_000_000)
		return { error: 'Invalid credit reward.' };
	if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)
		return { error: 'Invalid max uses.' };

	return { code, credits, maxUses };
}

export async function GET({ cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user || user.role !== 'ADMIN') {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const codes = db
			.prepare(
				`
            SELECT p.*, u.username as creatorName 
            FROM promo_codes p 
            LEFT JOIN users u ON p.created_by = u.id 
            ORDER BY p.created_at DESC
        `
			)
			.all();
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

	try {
		const parsed = parsePromo(await request.json().catch(() => null));
		if ('error' in parsed) return json({ error: parsed.error }, { status: 400 });

		db.prepare(
			'INSERT INTO promo_codes (code, credits_reward, max_uses, created_by) VALUES (?, ?, ?, ?)'
		).run(parsed.code, parsed.credits, parsed.maxUses, user.id);

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
		const body = await request.json().catch(() => null);
		const id = Number(body?.id);
		if (!Number.isInteger(id) || id <= 0)
			return json({ error: 'Missing code ID' }, { status: 400 });

		const parsed = parsePromo(body);
		if ('error' in parsed) return json({ error: parsed.error }, { status: 400 });

		db.prepare(
			'UPDATE promo_codes SET code = ?, credits_reward = ?, max_uses = ? WHERE id = ?'
		).run(parsed.code, parsed.credits, parsed.maxUses, id);

		return json({ success: true, message: 'Promo code updated successfully' });
	} catch (e: any) {
		if (e.message && e.message.includes('UNIQUE constraint failed')) {
			return json({ error: 'A promo code with this name already exists' }, { status: 400 });
		}
		console.error('Promo update error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}

export async function DELETE({ request, cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user || user.role !== 'ADMIN') return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json().catch(() => null);
		const id = Number(body?.id);
		if (!Number.isInteger(id) || id <= 0)
			return json({ error: 'Missing code ID' }, { status: 400 });

		db.prepare('DELETE FROM promo_codes WHERE id = ?').run(id);
		return json({ success: true, message: 'Promo code deleted' });
	} catch (e) {
		console.error('Promo delete error:', e);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
}
