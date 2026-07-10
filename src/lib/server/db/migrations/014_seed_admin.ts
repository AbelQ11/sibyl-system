import { db } from '../connection';
import bcrypt from 'bcryptjs';
import type { Migration } from '../migrate';

export const migration: Migration = {
    id: '014_seed_admin',
    up() {
        const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
        if (!adminPassword) {
            console.warn('[SIBYL MIGRATE] ADMIN_INITIAL_PASSWORD not set — skipping admin seed. Set it in .env and restart to seed the admin account.');
            return;
        }

        const adminExists = db.prepare("SELECT id FROM users WHERE username = 'Makishimadmin'").get();
        if (!adminExists) {
            const salt = bcrypt.genSaltSync(10);
            const hash = bcrypt.hashSync(adminPassword, salt);
            db.prepare("INSERT INTO users (username, password, citizen_id, role) VALUES (?, ?, ?, ?)").run(
                'Makishimadmin', hash, 'SIB-00000000', 'ADMIN'
            );
            console.log("[SIBYL MIGRATE] Seeded admin user 'Makishimadmin' with ID 'SIB-00000000'.");
        }
    }
};
