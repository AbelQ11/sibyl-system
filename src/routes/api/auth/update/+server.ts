import { db } from "$lib/server/db";
import bcrypt from 'bcryptjs';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    try {
        const { oldUsername, newUsername, newPassword, privacy, bio } = await request.json();

        if (!oldUsername) {
            return json({ success: false, message: 'MISSING_IDENTIFIER' }, { status: 400 });
        }

        if (!newUsername || newUsername.length < 1 || newUsername.length > 15) {
            return json({ success: false, message: 'AUTH_ERR_USERNAME_LENGTH' }, { status: 400 });
        }

        const userPrivacy = privacy || 'PRIVATE';
        
        let safeBio = null;
        if (bio !== undefined) {
            safeBio = typeof bio === 'string' ? bio.substring(0, 50) : null;
        }

        if (newPassword && newPassword.trim() !== '') {
            // Validate password strength: length 8-30, has uppercase, lowercase, and digit
            const isLengthValid = newPassword.length >= 8 && newPassword.length <= 30;
            const hasUpper = /[A-Z]/.test(newPassword);
            const hasLower = /[a-z]/.test(newPassword);
            const hasDigit = /[0-9]/.test(newPassword);

            if (!isLengthValid || !hasUpper || !hasLower || !hasDigit) {
                return json({ success: false, message: 'AUTH_ERR_PASSWORD_STRENGTH' }, { status: 400 });
            }

            const hash = await bcrypt.hash(newPassword, 10);
            const stmt = db.prepare('UPDATE users SET username = ?, password = ?, privacy = ?, bio = ? WHERE username = ?');
            const result = stmt.run(newUsername, hash, userPrivacy, safeBio, oldUsername);

            if (result.changes === 0) return json({ success: false, message: 'USER_NOT_FOUND' }, { status: 404 });
        }
        else {
            const stmt = db.prepare('UPDATE users SET username = ?, privacy = ?, bio = ? WHERE username = ?');
            const result = stmt.run(newUsername, userPrivacy, safeBio, oldUsername);

            if (result.changes === 0) return json({ success: false, message: 'USER_NOT_FOUND' }, { status: 404 });
        }

        return json({ success: true });
    } catch (e: any) {
        console.error('Failed to update core citizen profile identifier logs:', e.message);
        return json({ success: false, message: 'IDENTIFIER_TAKEN_OR_DB_FAULT' }, { status: 500 });
    }
}