import { db } from '../db/connection';

export interface UserRepoModel {
    id: number;
    username: string;
    avatar: string | null;
    role: string;
    nameEffect?: string | null;
    avatarBorder?: string | null;
}

export function getUserWithCosmetics(userId: number): UserRepoModel | undefined {
    return db.prepare(`
        SELECT u.id, u.username, u.avatar, u.role,
            (SELECT c.value FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmeticId = c.id WHERE uc.userId = u.id AND c.type = 'name_effect' AND uc.equipped = 1 LIMIT 1) as nameEffect,
            (SELECT c.value FROM user_cosmetics uc JOIN cosmetics c ON uc.cosmeticId = c.id WHERE uc.userId = u.id AND c.type = 'avatar_border' AND uc.equipped = 1 LIMIT 1) as avatarBorder
        FROM users u
        WHERE u.id = ?
    `).get(userId) as UserRepoModel | undefined;
}
