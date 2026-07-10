import { db } from "$lib/server/db";
import { createSession, getCookieOptions } from '$lib/server/session';
import { generateCitizenId } from '$lib/server/auth';
import bcrypt from 'bcryptjs';
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
    default: async ({ request, cookies }) => {
        const data = await request.formData();
        const username = data.get('username') as string;
        const password = data.get('password') as string;

        /** Validate password strength: length 8-30, has uppercase, lowercase, and digit */
        const isLengthValid = password && password.length >= 8 && password.length <= 30;
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasDigit = /[0-9]/.test(password);

        if (!isLengthValid || !hasUpper || !hasLower || !hasDigit) {
            return fail(400, { error: "AUTH_ERR_PASSWORD_STRENGTH" });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const citizenId = generateCitizenId();

            const stmt = db.prepare('INSERT INTO users (username, password, citizen_id) VALUES (?, ?, ?)');
            const result = stmt.run(username, hashedPassword, citizenId);

            const token = createSession(Number(result.lastInsertRowid));
            cookies.set('session', token, getCookieOptions());
        } catch (e) {
            return fail(400, { error: "IDENTIFIER ALREADY IN USE" });
        }

        throw redirect(303, '/');
    }
};