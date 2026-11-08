import { db } from './connection';

export interface Migration {
	id: string;
	up: () => void;
	/**
	 * Set for migrations that rebuild a table referenced by foreign keys.
	 * PRAGMA foreign_keys cannot be changed inside a transaction, so the
	 * runner toggles it around the migration transaction.
	 */
	disableForeignKeys?: boolean;
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

		const foreignKeysWereEnabled = db.pragma('foreign_keys', { simple: true }) === 1;
		if (migration.disableForeignKeys) {
			db.pragma('foreign_keys = OFF');
		}

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
		} finally {
			if (migration.disableForeignKeys) {
				db.pragma(`foreign_keys = ${foreignKeysWereEnabled ? 'ON' : 'OFF'}`);
				if (foreignKeysWereEnabled) {
					const violations = db.prepare('PRAGMA foreign_key_check').all();
					if (violations.length > 0) {
						console.error('[SIBYL MIGRATE] Foreign key violations after migration:', violations);
					}
				}
			}
		}
	}
}
