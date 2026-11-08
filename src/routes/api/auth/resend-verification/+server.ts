import { json } from '@sveltejs/kit';
import { getAuthUser } from '$lib/server/auth';
import { issueEmailVerification } from '$lib/server/emailVerification';
import { consumeRateLimit, rateLimitResponse } from '$lib/server/rateLimit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies, url }) => {
	const user = getAuthUser(cookies.get('session'));
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

	if (!user.email) {
		return json({ error: 'No email address is set on this account' }, { status: 400 });
	}

	if (user.email_verified) {
		return json({ success: true, message: 'Email is already verified' });
	}

	const limit = consumeRateLimit(`verify-resend:${user.id}`, 3, 15 * 60_000);
	if (!limit.allowed) return rateLimitResponse(limit.retryAfterSeconds);

	const sent = await issueEmailVerification(user.id, user.email, url.origin);
	if (!sent) {
		return json({ error: 'Verification email could not be sent' }, { status: 502 });
	}

	return json({ success: true, message: 'Verification email sent' });
};
