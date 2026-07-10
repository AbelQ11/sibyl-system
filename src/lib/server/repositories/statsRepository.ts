import { db } from '../db/connection';

export function getLatestCC(userId: number): number {
    const stats = db.prepare(`
        SELECT cc FROM userStats 
        WHERE userId = ? 
        ORDER BY created_at DESC LIMIT 1
    `).get(userId) as { cc: number } | undefined;
    
    return stats ? stats.cc : 0;
}

export function insertCC(userId: number, cc: number, type: string): void {
    db.prepare('INSERT INTO userStats (userId, cc, type) VALUES (?, ?, ?)').run(userId, cc, type);
}
