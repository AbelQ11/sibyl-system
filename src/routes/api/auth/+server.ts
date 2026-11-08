import { json } from '@sveltejs/kit';
import bcrypt from 'bcryptjs';
import { db } from '$lib/server/db';
import {
	authenticateUser,
	findUserByEmail,
	generateCitizenId,
	isReservedUsername,
	normalizeEmail
} from '$lib/server/auth';
import { createSession, deleteSession, getCookieOptions } from '$lib/server/session';
import {
	clientIp,
	consumeRateLimit,
	rateLimitResponse,
	resetRateLimit
} from '$lib/server/rateLimit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validUsername(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const trimmed = value.trim();
	return trimmed.length >= 1 && trimmed.length <= 15 && !/[\u0000-\u001f\u007f]/.test(trimmed);
}

function validPassword(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value.length >= 8 &&
		value.length <= 30 &&
		/[A-Z]/.test(value) &&
		/[a-z]/.test(value) &&
		/[0-9]/.test(value)
	);
}

/**
 * Handles authentication requests including user registration, login, and logout.
 */
export async function POST({ request, cookies }) {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, code: 'INVALID' }, { status: 400 });
	}

	const action = body.action;
	const username = typeof body.username === 'string' ? body.username.trim() : '';
	const password = typeof body.password === 'string' ? body.password : '';
	const email = normalizeEmail(body.email);

	if (action === 'REGISTER') {
		const ipLimit = consumeRateLimit(`register:ip:${clientIp(request)}`, 5, 15 * 60_000);
		if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);

		if (!validUsername(username)) {
			return json({ success: false, code: 'AUTH_ERR_USERNAME_LENGTH' });
		}
		if (!validPassword(password)) {
			return json({ success: false, code: 'AUTH_ERR_PASSWORD_STRENGTH' });
		}
		if (email !== null && !EMAIL_RE.test(email)) {
			return json({ success: false, code: 'AUTH_ERR_EMAIL_INVALID' });
		}
		if (isReservedUsername(username)) {
			return json({ success: false, code: 'AUTH_ERR_USERNAME_RESERVED' });
		}
		if (email && findUserByEmail(email)) {
			return json({ success: false, code: 'AUTH_ERR_EMAIL_TAKEN' });
		}

		try {
			const hash = await bcrypt.hash(password, 12);
			const citizenId = generateCitizenId();

			const result = db
				.prepare('INSERT INTO users (username, password, citizen_id, email) VALUES (?, ?, ?, ?)')
				.run(username, hash, citizenId, email);

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
			return json({ success: true, code: 'REG_OK', user: username, citizen_id: citizenId });
		} catch (e: any) {
			if (typeof e?.message === 'string' && e.message.includes('idx_users_email')) {
				return json({ success: false, code: 'AUTH_ERR_EMAIL_TAKEN' });
			}
			console.error('Registration failed:', e);
			return json({ success: false, code: 'REG_ERR' });
		}
	}

	if (action === 'LOGIN') {
		const identifier = (typeof body.identifier === 'string' ? body.identifier : username).trim();

		const ipLimit = consumeRateLimit(`login:ip:${clientIp(request)}`, 20, 15 * 60_000);
		if (!ipLimit.allowed) return rateLimitResponse(ipLimit.retryAfterSeconds);

		const idLimit = consumeRateLimit(`login:id:${identifier.toLowerCase()}`, 10, 15 * 60_000);
		if (!idLimit.allowed) return rateLimitResponse(idLimit.retryAfterSeconds);

		const result = await authenticateUser(identifier, password);

		if (result.code === 'OK') {
			resetRateLimit(`login:id:${identifier.toLowerCase()}`);
			const token = createSession(result.user.id);
			cookies.set('session', token, getCookieOptions());
			return json({
				success: true,
				code: 'AUTH_OK',
				user: result.user.username,
				citizen_id: result.user.citizen_id,
				avatar: result.user.avatar || null
			});
		}

		if (result.code === 'AMBIGUOUS') {
			return json({
				success: false,
				code: 'AUTH_ERR_AMBIGUOUS',
				message: 'Several citizens share this username. Please sign in with your email.'
			});
		}

		return json({ success: false, code: 'AUTH_ERR' });
	}

	if (action === 'LOGOUT') {
		const token = cookies.get('session');
		if (token) deleteSession(token);
		cookies.delete('session', { path: '/' });
		return json({ success: true });
	}

	return json({ success: false, code: 'INVALID' }, { status: 400 });
}
