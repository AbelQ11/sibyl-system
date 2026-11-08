import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { redirect } from '@sveltejs/kit';
import { db } from './db';
import { getSession } from './session';

export interface User {
	id: number;
	username: string;
	avatar: string | null;
	citizen_id: string;
	privacy: string;
	discord_username: string | null;
	discord_id: string | null;
	role: string;
	bio: string;
	credits: number;
	email: string | null;
	email_verified: number;
}

export interface AuthUserRow extends User {
	password: string;
}

export type PublicUserMatch = Pick<
	User,
	'id' | 'username' | 'avatar' | 'citizen_id' | 'role' | 'privacy'
>;

export interface PublicUserResolution {
	user?: PublicUserMatch;
	ambiguous?: boolean;
	matches?: PublicUserMatch[];
}

const PUBLIC_USER_COLUMNS =
	'id, username, avatar, citizen_id, privacy, discord_username, discord_id, role, bio, credits, email, email_verified';
const MAX_PASSWORD_CANDIDATES = 20;

let dummyHash: string | undefined;
function getDummyHash(): string {
	// Equalize response time when no account exists, so username/email
	// existence cannot be inferred from a fast failure.
	dummyHash ??= bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
	return dummyHash;
}

/**
 * Resolves the full user object from a session token.
 * Returns the User if the session is valid, or undefined if not.
 * Use this in API routes (which return 401 JSON on failure).
 */
export function getAuthUser(token: string | undefined): User | undefined {
	const session = getSession(token);
	if (!session) return undefined;

	return db.prepare(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE id = ?`).get(session.userId) as
		User | undefined;
}

/**
 * Like getAuthUser but throws a redirect(302, '/auth') for use in
 * SvelteKit page/layout server load functions.
 */
export function requireAuth(token: string | undefined): User {
	const user = getAuthUser(token);
	if (!user) throw redirect(302, '/auth');
	return user;
}

/**
 * Asserts that a user has the required role.
 * Throws redirect(302, '/') if the role doesn't match.
 * Use after requireAuth or getAuthUser.
 */
export function requireRole(user: User, role: 'ADMIN' | 'INSPECTOR'): void {
	if (user.role !== role) throw redirect(302, '/');
}

/**
 * Generates a unique SIB-XXXXXXXX citizen ID.
 * Uses a CSPRNG so IDs are not predictable from Math.random state.
 */
export function generateCitizenId(): string {
	for (let attempt = 0; attempt < 100; attempt++) {
		let numStr = '';
		for (let i = 0; i < 8; i++) numStr += crypto.randomInt(0, 10).toString();
		const citizenId = `SIB-${numStr}`;
		if (!db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(citizenId)) {
			return citizenId;
		}
	}
	return `SIB-${String(Date.now()).slice(-8)}`;
}

export function normalizeEmail(email: unknown): string | null {
	if (typeof email !== 'string') return null;
	const trimmed = email.trim().toLowerCase();
	return trimmed.length > 0 ? trimmed : null;
}

export function findUsersByUsername(username: string): AuthUserRow[] {
	return db.prepare('SELECT * FROM users WHERE username = ?').all(username.trim()) as AuthUserRow[];
}

export function findUserByEmail(email: string): AuthUserRow | undefined {
	return db
		.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE')
		.get(normalizeEmail(email)) as AuthUserRow | undefined;
}

export function findUserByCitizenId(citizenId: string): PublicUserMatch | undefined {
	return db
		.prepare(`SELECT ${PUBLIC_USER_COLUMNS} FROM users WHERE citizen_id = ? COLLATE NOCASE`)
		.get(citizenId.trim()) as PublicUserMatch | undefined;
}

/**
 * Resolves a public identifier (Citizen ID, or a username when unique).
 * Duplicate usernames are treated as ambiguous instead of picking one
 * arbitrary account.
 */
export function resolvePublicUser(identifier: string): PublicUserResolution {
	const value = identifier?.trim();
	if (!value) return {};

	if (/^SIB-\d{8}$/i.test(value)) {
		const user = findUserByCitizenId(value);
		return user ? { user } : {};
	}

	const rows = db
		.prepare(
			`
        SELECT ${PUBLIC_USER_COLUMNS}
        FROM users
        WHERE username = ?
        ORDER BY id ASC
        LIMIT 10
    `
		)
		.all(value) as PublicUserMatch[];

	if (rows.length === 0) return {};
	if (rows.length === 1) return { user: rows[0] };
	return { ambiguous: true, matches: rows };
}

export type LoginResult =
	| { code: 'OK'; user: AuthUserRow }
	| { code: 'INVALID' }
	| { code: 'EMAIL_UNVERIFIED' }
	| { code: 'AMBIGUOUS'; matches: Array<Pick<AuthUserRow, 'id' | 'username' | 'citizen_id'>> };

/**
 * Username-first sign-in: with duplicate display names, every account using
 * that username is checked against the supplied password. Exactly one match
 * wins; a password collision returns AMBIGUOUS and the user must sign in with
 * their email. Email sign-in is a single unique comparison.
 */
export async function authenticateUser(identifier: string, password: string): Promise<LoginResult> {
	const value = (identifier || '').trim();
	if (!value || typeof password !== 'string' || password.length === 0) {
		return { code: 'INVALID' };
	}

	if (value.includes('@')) {
		const row = findUserByEmail(value);
		if (row && (await bcrypt.compare(password, row.password))) {
			if (!row.email_verified) return { code: 'EMAIL_UNVERIFIED' };
			return { code: 'OK', user: row };
		}
		await bcrypt.compare(password, getDummyHash());
		return { code: 'INVALID' };
	}

	const candidates = findUsersByUsername(value);
	if (candidates.length === 0) {
		await bcrypt.compare(password, getDummyHash());
		return { code: 'INVALID' };
	}

	// Refuse unbounded bcrypt work: a username with too many duplicates must
	// use the unique email instead.
	if (candidates.length > MAX_PASSWORD_CANDIDATES) {
		return {
			code: 'AMBIGUOUS',
			matches: candidates
				.slice(0, MAX_PASSWORD_CANDIDATES)
				.map(({ id, username, citizen_id }) => ({ id, username, citizen_id }))
		};
	}

	const matches: AuthUserRow[] = [];
	for (const candidate of candidates) {
		if (await bcrypt.compare(password, candidate.password)) {
			matches.push(candidate);
		}
	}

	if (matches.length === 1) {
		return { code: 'OK', user: matches[0] };
	}
	if (matches.length > 1) {
		return {
			code: 'AMBIGUOUS',
			matches: matches.map(({ id, username, citizen_id }) => ({ id, username, citizen_id }))
		};
	}
	return { code: 'INVALID' };
}

/**
 * Prevents account-name impersonation while still allowing duplicate normal
 * display names. SIB-* is reserved for the canonical Citizen ID format.
 */
export function isReservedUsername(username: string): boolean {
	const value = username.trim();
	if (/^SIB-/i.test(value)) return true;

	const configuredAdmin = (process.env.ADMIN_ACCOUNT_ID || 'Makishimadmin').trim().toLowerCase();
	if (value.toLowerCase() === configuredAdmin) return true;

	const admin = db
		.prepare(
			`
        SELECT 1 FROM users
        WHERE role = 'ADMIN' AND lower(username) = lower(?)
        LIMIT 1
    `
		)
		.get(value);
	return Boolean(admin);
}
