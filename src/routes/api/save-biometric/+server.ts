import { json } from '@sveltejs/kit';
import { getAuthUser } from '$lib/server/auth';
import { insertCC } from '$lib/server/repositories/statsRepository';
import { consumeRateLimit, rateLimitResponse } from '$lib/server/rateLimit';

export async function POST({ request, cookies }) {
	const user = getAuthUser(cookies.get('session'));
	if (!user) {
		return json({ error: 'Unauthorized: Active session required.' }, { status: 401 });
	}

	const limit = consumeRateLimit(`biometric:${user.id}`, 30, 60_000);
	if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

	try {
		const body = await request.json().catch(() => null);
		const cc = Number(body?.cc);

		if (!Number.isFinite(cc) || cc < 0 || cc > 500) {
			return json({ error: 'Invalid crime coefficient' }, { status: 400 });
		}

		insertCC(user.id, cc, 'biometric');
		return json({ success: true });
	} catch (err: any) {
		console.error('Failed to save biometric scan CC:', err?.message);
		return json({ error: 'Database tracking failure' }, { status: 500 });
	}
}
