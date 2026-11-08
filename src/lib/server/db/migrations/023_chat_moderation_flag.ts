import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
	id: '023_chat_moderation_flag',
	up() {
		try {
			db.exec('ALTER TABLE chat_messages ADD COLUMN is_censored INTEGER DEFAULT 0;');
		} catch {
			/* already exists */
		}
	}
};
