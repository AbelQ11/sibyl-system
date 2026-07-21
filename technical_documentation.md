# SIBYL System — Technical Documentation

## Architecture Overview
The SIBYL System is built on **SvelteKit 2** (using Svelte 5) and leverages **better-sqlite3** for highly performant, synchronous local data persistence. It operates as a unified monolithic Node.js web server.

### 1. Data Persistence Layer (`better-sqlite3`)
The application eschews ORMs like Prisma in favor of direct SQLite binding via `better-sqlite3`. 
- **Initialization**: Database tables (`users`, `userStats`, `friend_requests`, `chat_messages`, `chat_groups`, `posts`, `post_likes`, `post_comments`) are initialized dynamically via `CREATE TABLE IF NOT EXISTS` pragmas inside `src/lib/server/db.ts` on server boot.
- **Performance**: Because Node.js is single-threaded, `better-sqlite3` runs synchronously, providing extremely fast read/write speeds without async overhead, which is critical for real-time telemetry logging.

### 2. State Management & Reactivity
The frontend leverages Svelte 5's fine-grained reactivity.
- **Stores**: Global state such as `$appMode`, `$crimeCoefficient`, and `$currentUser` are managed via Svelte stores (`src/lib/stores.ts`), allowing deep components like `ScannerHUD.svelte` and `BreathingVisualizer.svelte` to react instantly to biometric changes.
- **UI Architecture**: Component logic handles mock biometric generation (using `Math.random` combined with `setInterval` scramblers) before resolving to a final "Crime Coefficient".

### 3. Real-Time Chat, SSE & Voice Communications
To implement real-time communication without a heavy dependency like Socket.io, SIBYL utilizes SvelteKit API endpoints returning `ReadableStream` alongside WebRTC.
- **SSE Stream**: The server maintains a `Map` of connected client `Controller` instances. When a `POST` request hits the `/api/chat/send` endpoint, the server pushes the payload to clients via their open Server-Sent Events stream.
- **Voice Messaging**: Citizens can record asynchronous voice transmissions in Private and Group chats. The microphone data is buffered into Blob chunks, encoded to Base64 (`audio/webm`), and processed through the standard message attachment pipeline, rendering via a custom `VoicePlayer` UI component.
- **Real-Time Voice Calls (WebRTC)**: The system supports live Peer-to-Peer (P2P) voice calls for up to 10 participants per group. It uses a mesh-network topology. WebRTC signaling (SDP offers/answers and ICE candidates) is routed entirely through a dedicated endpoint (`/api/webrtc/signal/+server.ts`), which cleverly piggybacks off the existing SSE stream (`chatStore.broadcast`) to avoid needing WebSocket infrastructure.
- **Transience**: "Read-Once" text messages are handled by issuing a `DELETE` query to SQLite immediately upon the receiver acknowledging the payload via a decryption API call.

### 4. Discord Bot Integration (`sibyl-bot`)
The companion bot runs as a separate Node process using `discord.js`.
- **Canvas Rendering**: Uses `@napi-rs/canvas` to composite Base64 avatars, text, and CC hues into a generated PNG buffer for the `/id` command.
- **Cross-Platform Sync**: The website and Discord bot communicate via standard internal REST endpoints, mirroring public and group messages bidirectionally.

### 5. Security & Privacy Context
- **Authentication**: Passwords are encrypted using `bcryptjs`. Session management relies on transient HTTP cookies (no persistence headers), ensuring session destruction upon browser closure.
- **Role-Based Access Control (RBAC)**: Specific user IDs (e.g., `SIB-00000000`) are granted hardcoded admin flags, allowing them to bypass SQL privacy clauses (e.g., overriding `WHERE privacy = 'PUBLIC'` filters in directory searches).
- **Auto-Admin Networking**: During user registration (`/api/auth`), the server automatically injects a friend request entry (`ACCEPTED` status) linking the new user and the `ADMIN` account. This bridges immediate comms and bypasses standard `PENDING` states.

### 6. AI Moderation & Multi-Provider Fallback
To enforce compliance, an asynchronous moderation daemon continuously scans messages sent to the `# PUBLIC_GLOBAL` channel.
- **Asynchronous Daemon**: When a message is sent (`/api/chat/send`), the server broadcasts the message and resolves the HTTP request instantly to maintain UI performance. Concurrently, a background `moderateMessage` promise evaluates the text. If the message triggers `hasInfraction: true`, the background task penalizes the sender's Crime Coefficient, updates SQLite, and fires a `message_edited` SSE event to redact the message globally.
- **Multi-Provider Fallback Engine (`aiFallbackEngine.ts`)**: To maximize uptime, AI calls are wrapped in a robust routing layer. The system first queries **Google Gemini (`gemini-3.1-flash-lite`)**. If the primary provider fails due to rate limits or API outages, the engine dynamically catches the failure and re-routes the identical prompt to a secondary provider (**OpenAI `gpt-4o-mini`**) with zero latency penalty to the user.

### 7. Dynamic Cosmetics & Pointer Engine
The application features a robust real-time cosmetic injection system powered by the SQLite backend.
- **Dynamic CSS Injection**: Cosmetic items (`interface_theme`, `avatar_border`, `name_effect`, `pointer_skin`) store raw CSS rule strings inside the `cosmetics` table. When a user equips an item, the `/api/cosmetics/css` endpoint concatenates all equipped CSS rules for the active session and serves them dynamically via a `<link rel="stylesheet">` tag.
- **Global Pointer Overrides**: The system overrides browser default cursors using custom SVG files hosted in the `static/cursors/` directory. Equipped pointer skins dynamically apply their pointer rules to the global `.app-wrapper`, overriding even interactive elements using `cursor: url(...), pointer !important;`. 
- **Shop & Preview Real-Time State**: The shop utilizes Svelte's reactive bindings (`class:owned={isOwned(id)}`) to instantly preview CSS styles. When an item is equipped, the layout performs a hard reload using SvelteKit's navigation to instantly pull the newly aggregated cosmetic CSS payload.
