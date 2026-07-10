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
}

/**
 * Resolves the full user object from a session token.
 * Returns the User if the session is valid, or undefined if not.
 * Use this in API routes (which return 401 JSON on failure).
 */
export function getAuthUser(token: string | undefined): User | undefined {
    const session = getSession(token);
    if (!session) return undefined;

    return db.prepare('SELECT id, username, avatar, citizen_id, privacy, discord_username, discord_id, role, bio, credits FROM users WHERE id = ?')
        .get(session.userId) as User | undefined;
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
 * Extracted here so the generation logic lives in one place.
 */
export function generateCitizenId(): string {
    let citizenId = '';
    let isUnique = false;
    while (!isUnique) {
        let numStr = '';
        for (let i = 0; i < 8; i++) numStr += Math.floor(Math.random() * 10).toString();
        citizenId = `SIB-${numStr}`;
        if (!db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(citizenId)) {
            isUnique = true;
        }
    }
    return citizenId;
}
