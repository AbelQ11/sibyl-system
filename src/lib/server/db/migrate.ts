import { db } from './connection';

export interface Migration {
    id: string;
    up: () => void;
}

/**
 * Runs any unapplied migrations against the database.
 * Tracks applied migrations in the `schema_migrations` table.
 * Migrations run synchronously and in order at server boot.
 */
export function runMigrations(migrations: Migration[]): void {
    // Ensure tracking table exists
    db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id TEXT PRIMARY KEY,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const isApplied = db.prepare('SELECT 1 FROM schema_migrations WHERE id = ?');
    const markApplied = db.prepare('INSERT INTO schema_migrations (id) VALUES (?)');

    for (const migration of migrations) {
        const alreadyApplied = isApplied.get(migration.id);
        if (alreadyApplied) continue;

        console.log(`[SIBYL MIGRATE] Applying migration: ${migration.id}`);
        try {
            const runMigration = db.transaction(() => {
                migration.up();
                markApplied.run(migration.id);
            });
            runMigration();
            console.log(`[SIBYL MIGRATE] ✓ ${migration.id}`);
        } catch (err) {
            console.error(`[SIBYL MIGRATE] ✗ Failed on ${migration.id}:`, err);
            throw err; // Halt boot on migration failure — don't silently continue
        }
    }
}
