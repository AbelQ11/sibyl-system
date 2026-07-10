import { db } from "$lib/server/db";
import { createSession, deleteSession, getCookieOptions } from '$lib/server/session';
import { generateCitizenId } from '$lib/server/auth';
import bcrypt from 'bcryptjs';
import { json } from '@sveltejs/kit';

/**
 * Handles authentication requests including user registration, login, and logout.
 *
 * @param {Object} event - The SvelteKit request event.
 * @param {Request} event.request - The incoming HTTP request containing the action and credentials.
 * @param {import('@sveltejs/kit').Cookies} event.cookies - The cookies object for session management.
 * @returns {Promise<Response>} JSON response indicating success or failure of the requested action.
 */
export async function POST({ request, cookies }) {
    const { action, username, password } = await request.json();

    if (action === 'REGISTER') {
        if (!username || username.length < 1 || username.length > 15) {
            return json({ success: false, code: 'AUTH_ERR_USERNAME_LENGTH' });
        }

        const isLengthValid = password && password.length >= 8 && password.length <= 30;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasDigit = /[0-9]/.test(password);

        if (!isLengthValid || !hasUpper || !hasLower || !hasDigit) {
            return json({ success: false, code: 'AUTH_ERR_PASSWORD_STRENGTH' });
        }

        try {
            const hash = await bcrypt.hash(password, 10);
            const citizenId = generateCitizenId();

            const stmt = db.prepare('INSERT INTO users (username, password, citizen_id) VALUES (?, ?, ?)');
            const result = stmt.run(username, hash, citizenId);

            const newUserId = Number(result.lastInsertRowid);

            try {
                const admin = db.prepare("SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1").get() as { id: number } | undefined;
                if (admin) {
                    db.prepare("INSERT INTO friend_requests (senderId, receiverId, status) VALUES (?, ?, 'ACCEPTED')").run(admin.id, newUserId);
                }
            } catch (err) {
                console.error("Failed to auto-add admin as friend:", err);
            }

            const token = createSession(newUserId);
            cookies.set('session', token, getCookieOptions());
            return json({ success: true, code: 'REG_OK', user: username });
        } catch (e) {
            return json({ success: false, code: 'REG_ERR' });
        }
    }

    if (action === 'LOGIN') {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username) as { id: number; username: string; password: string; avatar: string | null } | undefined;

        if (user && await bcrypt.compare(password, user.password)) {
            const token = createSession(user.id);
            cookies.set('session', token, getCookieOptions());

            return json({
                success: true,
                code: 'AUTH_OK',
                user: user.username,
                avatar: user.avatar || null
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
