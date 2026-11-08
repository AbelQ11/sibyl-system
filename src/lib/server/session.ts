import crypto from 'crypto';
import { db } from './db';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionRow {
	userId: number;
}

/**
 * Creates a new opaque session token for the given user and persists it.
 * Returns the token string to be stored in the session cookie.
 */
export function createSession(userId: number): string {
	const token = crypto.randomBytes(32).toString('hex');
	const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
	db.prepare('INSERT INTO sessions (token, userId, expires_at) VALUES (?, ?, ?)').run(
		token,
		userId,
		expiresAt
	);
	return token;
}

/**
 * Looks up an active session by token.
 * Returns the session row if valid and unexpired, otherwise undefined.
 *
 * julianday() is used instead of string comparison because stored values are
 * ISO strings (with "T" and "Z") while datetime('now') uses a space separator.
 */
export function getSession(token: string | undefined): SessionRow | undefined {
	if (!token) return undefined;
	return db
		.prepare(
			"SELECT userId FROM sessions WHERE token = ? AND julianday(expires_at) > julianday('now')"
		)
		.get(token) as SessionRow | undefined;
}

/**
 * Deletes a session token (logout).
 */
export function deleteSession(token: string): void {
	db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

/**
 * Deletes every session for a user. Used after a password change so stolen
 * sessions cannot outlive the credential they were created with.
 */
export function deleteSessionsForUser(userId: number): void {
	db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId);
}

/**
 * Purges all expired sessions. Call periodically (e.g., at server boot).
 */
export function cleanExpiredSessions(): void {
	const result = db
		.prepare("DELETE FROM sessions WHERE julianday(expires_at) <= julianday('now')")
		.run();
	if (result.changes > 0) {
		console.log(`[SIBYL SESSION] Purged ${result.changes} expired session(s).`);
	}
}

/**
 * Determines the correct cookie options based on environment.
 */
export function getCookieOptions() {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: process.env.NODE_ENV === 'production',
		maxAge: SESSION_TTL_MS / 1000
	};
}
