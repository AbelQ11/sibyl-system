import { db } from "$lib/server/db";
import bcrypt from 'bcryptjs';
import { json } from '@sveltejs/kit';

export async function POST({ request, cookies }) {
    const { action, username, password } = await request.json();

    if (action === 'REGISTER') {
        try {
            const hash = await bcrypt.hash(password, 10);
            const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
            const result = stmt.run(username, hash);

            // Secure login cookie
            cookies.set('session', result.lastInsertRowid.toString(), { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 604800 });
            return json({ success: true, code: 'REG_OK', user: username });
        } catch (e) {
            return json({ success: false, code: 'REG_ERR' }); // Username taken
        }
    }

    if (action === 'LOGIN') {
        const stmt = db.prepare('SELECT * FROM users WHERE username = ?');

        const user = stmt.get(username) as { id: number, username: string, password: string } | undefined;

        if (user && await bcrypt.compare(password, user.password)) {
            cookies.set('session', user.id.toString(), { path: '/', httpOnly: true, sameSite: 'strict', maxAge: 604800 });
            return json({ success: true, code: 'AUTH_OK', user: user.username });
        }
        return json({ success: false, code: 'AUTH_ERR' });
    }

    return json({ success: false, code: 'INVALID' }, { status: 400 });
}