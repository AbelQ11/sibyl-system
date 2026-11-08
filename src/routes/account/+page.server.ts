import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser, isReservedUsername, normalizeEmail } from '$lib/server/auth';
import { createSession, deleteSessionsForUser, getCookieOptions } from '$lib/server/session';
import { issueEmailVerification, resetEmailVerification } from '$lib/server/emailVerification';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Actions } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UpdateProfileSchema = z.object({
	username: z
		.string()
		.trim()
		.min(1, 'AUTH_ERR_USERNAME_LENGTH')
		.max(15, 'AUTH_ERR_USERNAME_LENGTH'),
	password: z
		.string()
		.optional()
		.refine((val) => {
			if (!val) return true;
			const isLengthValid = val.length >= 8 && val.length <= 30;
			const hasUpper = /[A-Z]/.test(val);
			const hasLower = /[a-z]/.test(val);
			const hasDigit = /[0-9]/.test(val);
			return isLengthValid && hasUpper && hasLower && hasDigit;
		}, 'AUTH_ERR_PASSWORD_STRENGTH'),
	privacy: z
		.enum(['PRIVATE', 'FRIENDS', 'GROUP ONLY', 'FRIENDS AND GROUP ONLY', 'PUBLIC'])
		.default('PRIVATE'),
	bio: z.string().max(50).optional().nullable(),
	email: z.string().optional().nullable()
});

export const actions: Actions = {
	updateProfile: async ({ request, cookies, url }) => {
		const user = getAuthUser(cookies.get('session'));
		if (!user) {
			return fail(401, { success: false, message: 'UNAUTHORIZED' });
		}

		const formData = await request.formData();
		const emailProvided = formData.has('email');
		const rawEmail = emailProvided ? normalizeEmail(formData.get('email')) : user.email;

		const payload = {
			username: formData.get('username')?.toString().trim() || '',
			password: formData.get('password')?.toString() || '',
			privacy: formData.get('privacy')?.toString() || 'PRIVATE',
			bio: formData.get('bio')?.toString() || '',
			email: rawEmail
		};

		const result = UpdateProfileSchema.safeParse(payload);

		if (!result.success) {
			const firstError = result.error.issues[0]?.message || 'INVALID_INPUT';
			return fail(400, { success: false, message: firstError });
		}

		const { username, password, privacy, bio, email } = result.data;

		if (/[\u0000-\u001f\u007f]/.test(username)) {
			return fail(400, { success: false, message: 'AUTH_ERR_USERNAME_LENGTH' });
		}

		if (username.toLowerCase() !== user.username.toLowerCase() && isReservedUsername(username)) {
			return fail(400, { success: false, message: 'AUTH_ERR_USERNAME_RESERVED' });
		}

		if (email !== null && email !== undefined) {
			if (!EMAIL_RE.test(email)) {
				return fail(400, { success: false, message: 'AUTH_ERR_EMAIL_INVALID' });
			}
			const existing = db
				.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id != ?')
				.get(email, user.id) as { id: number } | undefined;
			if (existing) {
				return fail(400, { success: false, message: 'AUTH_ERR_EMAIL_TAKEN' });
			}
		}

		const emailChanged = (email || null) !== (user.email || null);
		let verificationMessage = 'ACC_MSG_UPDATE_SUCCESS';

		if (emailChanged && !email) {
			resetEmailVerification(user.id);
		}

		try {
			if (password && password.trim() !== '') {
				const hash = await bcrypt.hash(password, 12);
				db.prepare(
					'UPDATE users SET username = ?, password = ?, privacy = ?, bio = ?, email = ?, email_verified = ? WHERE id = ?'
				).run(
					username,
					hash,
					privacy,
					bio,
					email || null,
					emailChanged ? 0 : user.email_verified,
					user.id
				);

				// Invalidate every session created with the old password, then
				// issue a fresh one for this browser.
				deleteSessionsForUser(user.id);
				const token = createSession(user.id);
				cookies.set('session', token, getCookieOptions());
			} else {
				db.prepare(
					'UPDATE users SET username = ?, privacy = ?, bio = ?, email = ?, email_verified = ? WHERE id = ?'
				).run(
					username,
					privacy,
					bio,
					email || null,
					emailChanged ? 0 : user.email_verified,
					user.id
				);
			}

			if (emailChanged && email) {
				const sent = await issueEmailVerification(user.id, email, url.origin);
				verificationMessage = sent ? 'ACC_MSG_VERIFICATION_SENT' : 'ACC_MSG_VERIFICATION_FAILED';
			} else if (emailChanged && !email) {
				verificationMessage = 'ACC_MSG_EMAIL_REMOVED';
			}

			return { success: true, message: verificationMessage };
		} catch (e: any) {
			console.error('Failed to update profile:', e?.message);
			if (typeof e?.message === 'string' && e.message.includes('idx_users_email')) {
				return fail(400, { success: false, message: 'AUTH_ERR_EMAIL_TAKEN' });
			}
			return fail(500, { success: false, message: 'IDENTIFIER_TAKEN_OR_DB_FAULT' });
		}
	}
};
