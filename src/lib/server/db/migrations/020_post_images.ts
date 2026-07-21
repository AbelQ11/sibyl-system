import { db } from '../connection';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '020_post_images',
    up() {
        db.exec(`
            ALTER TABLE posts ADD COLUMN image_url TEXT DEFAULT NULL;
        `);
    }
};
