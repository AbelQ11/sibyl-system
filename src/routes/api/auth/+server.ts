import { db } from "$lib/server/db";
import bcrypt from 'bcryptjs';
import { json } from '@sveltejs/kit';

export async function POST({ request, cookies }) {
    const { action, username, password } = await request.json();

    if (action === 'REGISTER') {
        // Validate username length: 1 to 15 characters
        if (!username || username.length < 1 || username.length > 15) {
            return json({ success: false, code: 'AUTH_ERR_USERNAME_LENGTH' });
        }

        // Validate password strength: length 8-30, has uppercase, lowercase, and digit
        const isLengthValid = password && password.length >= 8 && password.length <= 30;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasDigit = /[0-9]/.test(password);

        if (!isLengthValid || !hasUpper || !hasLower || !hasDigit) {
            return json({ success: false, code: 'AUTH_ERR_PASSWORD_STRENGTH' });
        }

        try {
            const hash = await bcrypt.hash(password, 10);
            
            // Generate a unique citizen_id (SIB-XXXXXXXX)
            let citizenId = '';
            let isUnique = false;
            while (!isUnique) {
                let numStr = '';
                for (let i = 0; i < 8; i++) {
                    numStr += Math.floor(Math.random() * 10).toString();
                }
                citizenId = `SIB-${numStr}`;
                
                const existing = db.prepare('SELECT id FROM users WHERE citizen_id = ?').get(citizenId);
                if (!existing) {
                    isUnique = true;
                }
            }

            const stmt = db.prepare('INSERT INTO users (username, password, citizen_id) VALUES (?, ?, ?)');
            const result = stmt.run(username, hash, citizenId);

            cookies.set('session', result.lastInsertRowid.toString(), { path: '/', httpOnly: true, sameSite: 'lax' });
            return json({ success: true, code: 'REG_OK', user: username });
        } catch (e) {
            return json({ success: false, code: 'REG_ERR' }); // Username taken
        }
    }

    if (action === 'LOGIN') {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
        const user = stmt.get(username) as { id: number, username: string, password: string, avatar: string | null } | undefined;

        if (user && await bcrypt.compare(password, user.password)) {
            cookies.set('session', user.id.toString(), { path: '/', httpOnly: true, sameSite: 'lax' });

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
        cookies.delete('session', { path: '/' });
        return json({ success: true });
    }

    return json({ success: false, code: 'INVALID' }, { status: 400 });
}