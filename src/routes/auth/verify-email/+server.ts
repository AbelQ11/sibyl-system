import { redirect } from '@sveltejs/kit';
import { getAuthUser } from '$lib/server/auth';
import { consumeEmailVerificationToken } from '$lib/server/emailVerification';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies }) => {
	const token = url.searchParams.get('token') || '';
	const result = consumeEmailVerificationToken(token);
	const currentUser = getAuthUser(cookies.get('session'));

	if (result.ok && currentUser && result.userId === currentUser.id) {
		throw redirect(303, '/account?email=verified');
	}

	if (result.ok) {
		throw redirect(303, '/auth?email=verified');
	}

	if (currentUser) {
		throw redirect(303, '/account?email=invalid');
	}

	throw redirect(303, '/auth?email=invalid');
};
