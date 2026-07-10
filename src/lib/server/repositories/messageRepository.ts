import { db } from '../db/connection';

export function insertMessage(
    senderId: number,
    text: string,
    targetType: string,
    targetId: number | null,
    isReadOnce: number,
    replyToId: number | null,
    attachmentUrl: string | null
): bigint {
    let receiverId = targetType === 'PRIVATE' ? targetId : null;
    let groupId = targetType === 'GROUP' ? targetId : null;

    const stmt = db.prepare(`
        INSERT INTO chat_messages (senderId, receiverId, groupId, text, isReadOnce, replyToId, attachment) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
        senderId, 
        receiverId, 
        groupId, 
        text, 
        isReadOnce, 
        replyToId,
        attachmentUrl
    );
    
    return info.lastInsertRowid;
}
