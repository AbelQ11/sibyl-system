import { db } from "$lib/server/db";
import { getAuthUser } from '$lib/server/auth';
import bcrypt from 'bcryptjs';
import { json } from '@sveltejs/kit';

export async function POST({ request, cookies }) {
    const user = getAuthUser(cookies.get('session'));
    if (!user) {
        return json({ success: false, message: 'UNAUTHORIZED' }, { status: 401 });
    }

    try {
        const { newUsername, newPassword, privacy, bio } = await request.json();

        if (!newUsername || newUsername.length < 1 || newUsername.length > 15) {
            return json({ success: false, message: 'AUTH_ERR_USERNAME_LENGTH' }, { status: 400 });
        }

        const userPrivacy = privacy || 'PRIVATE';

        let safeBio = null;
        if (bio !== undefined) {
            safeBio = typeof bio === 'string' ? bio.substring(0, 50) : null;
        }

        if (newPassword && newPassword.trim() !== '') {

            const isLengthValid = newPassword.length >= 8 && newPassword.length <= 30;
            const hasUpper = /[A-Z]/.test(newPassword);
            const hasLower = /[a-z]/.test(newPassword);
            const hasDigit = /[0-9]/.test(newPassword);

            if (!isLengthValid || !hasUpper || !hasLower || !hasDigit) {
                return json({ success: false, message: 'AUTH_ERR_PASSWORD_STRENGTH' }, { status: 400 });
            }

            const hash = await bcrypt.hash(newPassword, 10);
            const result = db.prepare('UPDATE users SET username = ?, password = ?, privacy = ?, bio = ? WHERE id = ?')
                .run(newUsername, hash, userPrivacy, safeBio, user.id);

            if (result.changes === 0) return json({ success: false, message: 'USER_NOT_FOUND' }, { status: 404 });
        } else {
            const result = db.prepare('UPDATE users SET username = ?, privacy = ?, bio = ? WHERE id = ?')
                .run(newUsername, userPrivacy, safeBio, user.id);

            if (result.changes === 0) return json({ success: false, message: 'USER_NOT_FOUND' }, { status: 404 });
        }

        return json({ success: true });
    } catch (e: any) {
        console.error('Failed to update core citizen profile identifier logs:', e.message);
        return json({ success: false, message: 'IDENTIFIER_TAKEN_OR_DB_FAULT' }, { status: 500 });
    }
}
