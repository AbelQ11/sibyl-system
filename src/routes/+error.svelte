<script lang="ts">
    import { page } from '$app/stores';
</script>

<svelte:head>
    <title>Error {$page.status} — Sibyl System</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="theme-color" content="#00ffcc" />
</svelte:head>

<div class="error-screen">
    <p class="code">ERROR::{$page.status}</p>
    <h1>{$page.status === 404 ? 'SIGNAL NOT FOUND' : 'SYSTEM FAULT'}</h1>
    <p class="message">
        {$page.status === 404
            ? 'The requested node is not part of the Sibyl network.'
            : 'The terminal encountered an unexpected condition. Try again later.'}
    </p>
    <a href="/">[ RETURN TO HUB ]</a>
</div>

<style>
    .error-screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        height: 100%;
        padding: 40px 20px;
        text-align: center;
        font-family: 'Courier New', Courier, monospace;
        color: var(--main-color, #00ffcc);
        background: var(--bg-color, #050505);
    }

    .code {
        margin: 0;
        font-size: 0.9rem;
        letter-spacing: 0.3em;
        color: #ff3355;
    }

    h1 {
        margin: 0;
        font-size: clamp(1.8rem, 6vw, 3rem);
        letter-spacing: 0.12em;
        text-shadow: 0 0 12px var(--main-glow, rgba(0, 255, 204, 0.5));
    }

    .message {
        margin: 0;
        max-width: 520px;
        color: rgba(220, 255, 250, 0.75);
    }

    a {
        margin-top: 10px;
        padding: 10px 18px;
        border: 1px solid var(--main-color, #00ffcc);
        color: var(--main-color, #00ffcc);
        text-decoration: none;
        letter-spacing: 0.12em;
    }

    a:hover {
        background: var(--main-color, #00ffcc);
        color: #000;
    }
</style>
