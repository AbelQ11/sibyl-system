/**
 * Database entry point.
 *
 * This module opens the SQLite connection, runs all pending versioned
 * migrations, and exports the `db` instance for use across the server.
 *
 * All schema changes must go through a migration file in:
 *   src/lib/server/db/migrations/
 *
 * Do NOT add inline DDL or data mutations here.
 */
import { db } from './db/connection';
import { runMigrations } from './db/migrate';
import { runDevSeeds } from './db/seed';

// Ordered list of all migrations — append new ones at the bottom.
import { migration as m001 } from './db/migrations/001_initial_schema';
import { migration as m002 } from './db/migrations/002_add_avatar';
import { migration as m003 } from './db/migrations/003_add_citizen_id';
import { migration as m004 } from './db/migrations/004_add_privacy';
import { migration as m005 } from './db/migrations/005_add_discord';
import { migration as m006 } from './db/migrations/006_add_role_bio';
import { migration as m007 } from './db/migrations/007_chat_tables';
import { migration as m008 } from './db/migrations/008_add_reply_attachment';
import { migration as m009 } from './db/migrations/009_economy';
import { migration as m010 } from './db/migrations/010_cosmetics';
import { migration as m011 } from './db/migrations/011_add_userstat_type';
import { migration as m012 } from './db/migrations/012_group_extras';
import { migration as m013 } from './db/migrations/013_group_requests';
import { migration as m014 } from './db/migrations/014_seed_admin';
import { migration as m015 } from './db/migrations/015_seed_cosmetics';
import { migration as m016 } from './db/migrations/016_sessions_table';
import { migration as m017 } from './db/migrations/017_promo_usage';

runMigrations([
    m001, m002, m003, m004, m005, m006, m007, m008,
    m009, m010, m011, m012, m013, m014, m015, m016, m017
]);

runDevSeeds();

export { db };
