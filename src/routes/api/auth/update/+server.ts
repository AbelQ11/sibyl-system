import { db } from "$lib/server/db";
import bcrypt from 'bcryptjs';
import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    try {
        const { oldUsername, newUsername, newPassword } = await request.json();

        if (!oldUsername) {
            return json({ success: false, message: 'MISSING_IDENTIFIER' }, { status: 400 });
        }

        if (newPassword && newPassword.trim() !== '') {
            const hash = await bcrypt.hash(newPassword, 10);
            const stmt = db.prepare('UPDATE users SET username = ?, password = ? WHERE username = ?');
            const result = stmt.run(newUsername, hash, oldUsername);

            if (result.changes === 0) return json({ success: false, message: 'USER_NOT_FOUND' }, { status: 404 });
        }
        else {
            const stmt = db.prepare('UPDATE users SET username = ? WHERE username = ?');
            const result = stmt.run(newUsername, oldUsername);

            if (result.changes === 0) return json({ success: false, message: 'USER_NOT_FOUND' }, { status: 404 });
        }

        return json({ success: true });
    } catch (e: any) {
        console.error('Failed to update core citizen profile identifier logs:', e.message);
        return json({ success: false, message: 'IDENTIFIER_TAKEN_OR_DB_FAULT' }, { status: 500 });
    }
}