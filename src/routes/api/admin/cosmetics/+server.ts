import { json } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

const TYPES = new Set(['avatar_border', 'name_effect', 'interface_theme', 'pointer_skin']);

function validate(body: any): string | null {
	if (!body || typeof body !== 'object') return 'Missing fields';
	if (!TYPES.has(body.type)) return 'Invalid cosmetic type';
	if (typeof body.name !== 'string' || body.name.trim().length === 0 || body.name.length > 50)
		return 'Invalid name';
	if (
		!Number.isInteger(Number(body.price)) ||
		Number(body.price) < 0 ||
		Number(body.price) > 1_000_000
	)
		return 'Invalid price';
	if (typeof body.value !== 'string' || body.value.length === 0 || body.value.length > 200)
		return 'Invalid value';
	if (
		typeof body.description !== 'string' ||
		body.description.length === 0 ||
		body.description.length > 200
	)
		return 'Invalid description';
	if (
		body.css_rules != null &&
		(typeof body.css_rules !== 'string' || body.css_rules.length > 20_000)
	)
		return 'Invalid CSS rules';
	return null;
}

export async function GET({ cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const cosmetics = db.prepare('SELECT * FROM cosmetics').all();
		return json({ success: true, cosmetics });
	} catch (e) {
		console.error('Cosmetics list error:', e);
		return json({ error: 'Failed to fetch cosmetics' }, { status: 500 });
	}
}

export async function POST({ request, cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const body = await request.json().catch(() => null);
		const error = validate(body);
		if (error) return json({ error }, { status: 400 });

		db.prepare(
			'INSERT INTO cosmetics (type, name, price, value, description, css_rules) VALUES (?, ?, ?, ?, ?, ?)'
		).run(
			body.type,
			body.name.trim(),
			Number(body.price),
			body.value,
			body.description,
			body.css_rules || null
		);

		return json({ success: true, message: 'Cosmetic created successfully' });
	} catch (e) {
		console.error('Cosmetic create error:', e);
		return json({ error: 'Failed to create cosmetic' }, { status: 500 });
	}
}

export async function PUT({ request, cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const body = await request.json().catch(() => null);
		const id = Number(body?.id);
		if (!Number.isInteger(id) || id <= 0)
			return json({ error: 'Missing cosmetic ID' }, { status: 400 });

		const error = validate(body);
		if (error) return json({ error }, { status: 400 });

		db.prepare(
			'UPDATE cosmetics SET type = ?, name = ?, price = ?, value = ?, description = ?, css_rules = ? WHERE id = ?'
		).run(
			body.type,
			body.name.trim(),
			Number(body.price),
			body.value,
			body.description,
			body.css_rules || null,
			id
		);

		return json({ success: true, message: 'Cosmetic updated successfully' });
	} catch (e) {
		console.error('Cosmetic update error:', e);
		return json({ error: 'Failed to update cosmetic' }, { status: 500 });
	}
}

export async function DELETE({ request, cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user || user.role !== 'ADMIN') return json({ error: 'Forbidden' }, { status: 403 });

	try {
		const body = await request.json().catch(() => null);
		const id = Number(body?.id);
		if (!Number.isInteger(id) || id <= 0)
			return json({ error: 'Missing cosmetic ID' }, { status: 400 });

		db.prepare('DELETE FROM cosmetics WHERE id = ?').run(id);
		return json({ success: true, message: 'Cosmetic deleted' });
	} catch (e) {
		console.error('Cosmetic delete error:', e);
		return json({ error: 'Failed to delete cosmetic' }, { status: 500 });
	}
}
