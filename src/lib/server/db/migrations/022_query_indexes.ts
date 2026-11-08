import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
	id: '022_query_indexes',
	up() {
		const indexes = [
			'CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);',
			'CREATE INDEX IF NOT EXISTS idx_userstats_user_id ON userStats(userId, id);',
			'CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiverId, status);',
			'CREATE INDEX IF NOT EXISTS idx_chat_messages_group_id ON chat_messages(groupId, id);',
			'CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver_id ON chat_messages(receiverId, id);',
			'CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(senderId, id);',
			'CREATE INDEX IF NOT EXISTS idx_group_requests_group_status ON group_requests(groupId, status);',
			'CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);',
			'CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(postId, id);'
		];

		for (const statement of indexes) {
			try {
				db.exec(statement);
			} catch (e) {
				console.warn('[SIBYL MIGRATE] Optional index skipped:', statement, e);
			}
		}
	}
};
