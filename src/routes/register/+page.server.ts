import { db } from '$lib/server/db';
import { createSession, getCookieOptions } from '$lib/server/session';
import {
	findUserByEmail,
	generateCitizenId,
	isReservedUsername,
	normalizeEmail
} from '$lib/server/auth';
import { clientIp, consumeRateLimit } from '$lib/server/rateLimit';
import bcrypt from 'bcryptjs';
import { fail, redirect } from '@sveltejs/kit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions = {
	default: async ({ request, cookies }) => {
		const ipLimit = consumeRateLimit(`register:ip:${clientIp(request)}`, 5, 15 * 60_000);
		if (!ipLimit.allowed) {
			return fail(429, { error: 'RATE_LIMITED' });
		}

		const data = await request.formData();
		const username = (data.get('username') as string | null)?.trim() || '';
		const password = (data.get('password') as string | null) || '';
		const email = normalizeEmail(data.get('email'));

		if (username.length < 1 || username.length > 15 || /[\u0000-\u001f\u007f]/.test(username)) {
			return fail(400, { error: 'AUTH_ERR_USERNAME_LENGTH' });
		}

		/** Validate password strength: length 8-30, has uppercase, lowercase, and digit */
		const isLengthValid = password.length >= 8 && password.length <= 30;
		const hasUpper = /[A-Z]/.test(password);
		const hasLower = /[a-z]/.test(password);
		const hasDigit = /[0-9]/.test(password);

		if (!isLengthValid || !hasUpper || !hasLower || !hasDigit) {
			return fail(400, { error: 'AUTH_ERR_PASSWORD_STRENGTH' });
		}

		if (email !== null && !EMAIL_RE.test(email)) {
			return fail(400, { error: 'AUTH_ERR_EMAIL_INVALID' });
		}
		if (email && findUserByEmail(email)) {
			return fail(400, { error: 'AUTH_ERR_EMAIL_TAKEN' });
		}
		if (isReservedUsername(username)) {
			return fail(400, { error: 'AUTH_ERR_USERNAME_RESERVED' });
		}

		try {
			const hashedPassword = await bcrypt.hash(password, 12);
			const citizenId = generateCitizenId();

			const stmt = db.prepare(
				'INSERT INTO users (username, password, citizen_id, email) VALUES (?, ?, ?, ?)'
			);
			const result = stmt.run(username, hashedPassword, citizenId, email);
			const newUserId = Number(result.lastInsertRowid);

			try {
				const admin = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get() as
					{ id: number } | undefined;
				if (admin) {
					db.prepare(
						"INSERT INTO friend_requests (senderId, receiverId, status) VALUES (?, ?, 'ACCEPTED')"
					).run(admin.id, newUserId);
				}
			} catch (err) {
				console.error('Failed to auto-add admin as friend:', err);
			}

			const token = createSession(newUserId);
			cookies.set('session', token, getCookieOptions());
		} catch (e: any) {
			if (typeof e?.message === 'string' && e.message.includes('idx_users_email')) {
				return fail(400, { error: 'AUTH_ERR_EMAIL_TAKEN' });
			}
			console.error('Registration failed:', e);
			return fail(400, { error: 'REG_ERR' });
		}

		throw redirect(303, '/account');
	}
};
