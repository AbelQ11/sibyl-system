<script lang="ts">
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';
    export let form;
</script>

<svelte:head>
    <title>{$dictionary[$locale].SEO_REGISTER_TITLE}</title>
    <meta name="description" content={$dictionary[$locale].SEO_REGISTER_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_REGISTER_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_REGISTER_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://sibyl-system.mooo.com/register" />
    <meta property="og:image" content="https://sibyl-system.mooo.com/favicon.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_REGISTER_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_REGISTER_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.mooo.com/favicon.png" />
</svelte:head>

<div class="auth-container" transition:fade>
    <div class="crt-overlay"></div>
    <form method="POST" class="auth-box">
        <h1>CITIZEN REGISTRATION</h1>
        <p class="subtitle">INPUT BIOMETRIC IDENTIFIER (USERNAME)</p>

        <input type="text" name="username" placeholder="USERNAME" required autocomplete="off" />
        <input type="password" name="password" placeholder="PASSWORD" required />
        <p class="field-hint">{$dictionary[$locale].REG_PASSWORD_RULES}</p>

        {#if form?.error}
            <p class="error">{form.error}</p>
        {/if}

        <button type="submit">INITIALIZE ID</button>
        <a href="/login">ALREADY REGISTERED? LOGIN</a>
    </form>
</div>

<style>
    .auth-container { height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; font-family: monospace; position: relative; }
    .auth-box { border: 1px solid #0ff; padding: 40px; background: rgba(0,255,255,0.05); display: flex; flex-direction: column; gap: 20px; z-index: 20; width: 350px; }
    h1 { color: #0ff; letter-spacing: 3px; margin: 0; font-size: 1.5rem; }
    input { background: rgba(0,255,255,0.1); border: 1px solid #0ff; padding: 12px; color: #fff; outline: none; }
    button { background: #0ff; color: #000; border: none; padding: 15px; cursor: pointer; font-weight: bold; letter-spacing: 2px; }
    button:hover { background: #fff; }
    .error { color: #ff4444; font-size: 0.8rem; }
    .field-hint { color: rgba(0, 255, 255, 0.6); font-size: 0.75rem; margin-top: -10px; line-height: 1.3; }
    a { color: #0ff; font-size: 0.8rem; text-decoration: none; text-align: center; opacity: 0.7; }
    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 2px, 3px 100%; pointer-events: none; z-index: 10; }
</style>