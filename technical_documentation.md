# SIBYL System — Technical Documentation

## Architecture Overview
The SIBYL System is built on **SvelteKit 2** (using Svelte 5) and leverages **better-sqlite3** for highly performant, synchronous local data persistence. It operates as a unified monolithic Node.js web server.

### 1. Data Persistence Layer (`better-sqlite3`)
The application eschews ORMs like Prisma in favor of direct SQLite binding via `better-sqlite3`. 
- **Initialization**: Database tables (`users`, `userStats`, `friend_requests`, `chat_messages`, `chat_groups`) are initialized dynamically via `CREATE TABLE IF NOT EXISTS` pragmas inside `src/lib/server/db.ts` on server boot.
- **Performance**: Because Node.js is single-threaded, `better-sqlite3` runs synchronously, providing extremely fast read/write speeds without async overhead, which is critical for real-time telemetry logging.

### 2. State Management & Reactivity
The frontend leverages Svelte 5's fine-grained reactivity.
- **Stores**: Global state such as `$appMode`, `$crimeCoefficient`, and `$currentUser` are managed via Svelte stores (`src/lib/stores.ts`), allowing deep components like `ScannerHUD.svelte` and `BreathingVisualizer.svelte` to react instantly to biometric changes.
- **UI Architecture**: Component logic handles mock biometric generation (using `Math.random` combined with `setInterval` scramblers) before resolving to a final "Crime Coefficient".

### 3. Real-Time Chat & SSE (Server-Sent Events)
To implement real-time communication without a heavy dependency like Socket.io, SIBYL utilizes SvelteKit API endpoints returning `ReadableStream`.
- **Memory Maps**: The server maintains a `Map` of connected client `Controller` instances.
- **Publish/Subscribe**: When a `POST` request hits the `/api/chat/send` endpoint, the server writes the message to SQLite and immediately pushes the payload to the respective clients via their open SSE streams.
- **Transience**: "Read-Once" messages are handled by issuing a `DELETE` query to SQLite immediately upon the receiver acknowledging the payload via a decryption API call.

### 4. Discord Bot Integration (`sibyl-bot`)
The companion bot runs as a separate Node process using `discord.js`.
- **Canvas Rendering**: Uses `@napi-rs/canvas` to composite Base64 avatars, text, and CC hues into a generated PNG buffer for the `/id` command.
- **Cross-Platform Sync**: The website and Discord bot communicate via standard internal REST endpoints, mirroring public and group messages bidirectionally.

### 5. Security & Privacy Context
- **Authentication**: Passwords are encrypted using `bcryptjs`. Session management relies on transient HTTP cookies (no persistence headers), ensuring session destruction upon browser closure.
- **Role-Based Access Control (RBAC)**: Specific user IDs (e.g., `SIB-00000000`) are granted hardcoded admin flags, allowing them to bypass SQL privacy clauses (e.g., overriding `WHERE privacy = 'PUBLIC'` filters in directory searches).
- **Auto-Admin Networking**: During user registration (`/api/auth`), the server automatically injects a friend request entry (`ACCEPTED` status) linking the new user and the `ADMIN` account. This bridges immediate comms and bypasses standard `PENDING` states.
