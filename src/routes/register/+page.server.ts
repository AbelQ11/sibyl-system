import { db } from "$lib/server/db";
import bcrypt from 'bcryptjs';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
    default: async ({ request, cookies }) => {
    const data = await request.formData();
    const username = data.get('username') as string;
    const password = data.get('password') as string;

    try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username, hashedPassword);

    cookies.set('session', result.lastInsertRowid.toString(), {
        path: '/',
        httpOnly: true,
        sameSite: 'strict'
    });

} catch (e) {
    return fail(400, { error: "IDENTIFIER ALREADY IN USE" });
}

    throw redirect(303, '/');
}
};