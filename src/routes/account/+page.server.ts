import { fail } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { Actions } from './$types';

const UpdateProfileSchema = z.object({
    username: z.string().min(1, 'AUTH_ERR_USERNAME_LENGTH').max(15, 'AUTH_ERR_USERNAME_LENGTH'),
    password: z.string().optional().refine(val => {
        if (!val) return true;
        const isLengthValid = val.length >= 8 && val.length <= 30;
        const hasUpper = /[A-Z]/.test(val);
        const hasLower = /[a-z]/.test(val);
        const hasDigit = /[0-9]/.test(val);
        return isLengthValid && hasUpper && hasLower && hasDigit;
    }, 'AUTH_ERR_PASSWORD_STRENGTH'),
    privacy: z.enum(['PRIVATE', 'FRIENDS', 'GROUP ONLY', 'FRIENDS AND GROUP ONLY', 'PUBLIC']).default('PRIVATE'),
    bio: z.string().max(50).optional().nullable()
});

export const actions: Actions = {
    updateProfile: async ({ request, cookies }) => {
        const user = getAuthUser(cookies.get('session'));
        if (!user) {
            return fail(401, { success: false, message: 'UNAUTHORIZED' });
        }

        const formData = await request.formData();
        const payload = {
            username: formData.get('username')?.toString() || '',
            password: formData.get('password')?.toString() || '',
            privacy: formData.get('privacy')?.toString() || 'PRIVATE',
            bio: formData.get('bio')?.toString() || ''
        };

        const result = UpdateProfileSchema.safeParse(payload);

        if (!result.success) {
            const firstError = result.error.errors[0].message;
            return fail(400, { success: false, message: firstError });
        }

        const { username, password, privacy, bio } = result.data;

        try {
            if (password && password.trim() !== '') {
                const hash = await bcrypt.hash(password, 10);
                const updateRes = db.prepare('UPDATE users SET username = ?, password = ?, privacy = ?, bio = ? WHERE id = ?')
                    .run(username, hash, privacy, bio, user.id);
                if (updateRes.changes === 0) return fail(404, { success: false, message: 'USER_NOT_FOUND' });
            } else {
                const updateRes = db.prepare('UPDATE users SET username = ?, privacy = ?, bio = ? WHERE id = ?')
                    .run(username, privacy, bio, user.id);
                if (updateRes.changes === 0) return fail(404, { success: false, message: 'USER_NOT_FOUND' });
            }

            return { success: true, message: 'ACC_MSG_UPDATE_SUCCESS' };
        } catch (e: any) {
            console.error('Failed to update profile:', e.message);
            return fail(500, { success: false, message: 'IDENTIFIER_TAKEN_OR_DB_FAULT' });
        }
    }
};
