<script lang="ts">
    import {currentUser, appMode, userAvatar} from '$lib/stores';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';

    $: t = (key: string) => ($dictionary[$locale] as Record<string, string>)[key] || key;

    let mode: 'PROMPT' | 'LOGIN' | 'REGISTER' = 'PROMPT';
    let username = '';
    let password = '';
    let confirmPassword = '';
    let showPassword = false;
    let statusMessage = '';

    async function handleAuth(action: 'LOGIN' | 'REGISTER') {
        statusMessage = $dictionary[$locale].AUTH_MSG_CONNECTING;

        if (action === 'REGISTER' && password !== confirmPassword) {
            statusMessage = $dictionary[$locale].AUTH_MSG_MISMATCH;
            return;
        }

        try {
            const res = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, username, password })
            });
            const data = await res.json();

            if (data.success) {
                currentUser.set(data.user);
                if (data.avatar) {
                    userAvatar.set(data.avatar);
                } else {
                    userAvatar.set(null);
                }
                appMode.set('INITIAL');

                const redirectTo = $page.url.searchParams.get('from') || '/';
                goto(redirectTo);
            } else {
                statusMessage = `${$dictionary[$locale].AUTH_MSG_FAILURE}${data.code}`;
            }
        } catch (err) {
            statusMessage = $dictionary[$locale].AUTH_MSG_ERROR;
        }
    }

    function switchMode(newMode: 'PROMPT' | 'LOGIN' | 'REGISTER') {
        mode = newMode;
        statusMessage = '';
        password = '';
        confirmPassword = '';
        showPassword = false;
    }
</script>

<svelte:head>
    <title>{$dictionary[$locale].SEO_AUTH_TITLE}</title>
    <meta name="description" content={$dictionary[$locale].SEO_AUTH_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_AUTH_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_AUTH_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://sibyl-system.mooo.com/auth" />
    <meta property="og:image" content="https://sibyl-system.mooo.com/favicon.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_AUTH_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_AUTH_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.mooo.com/favicon.png" />
</svelte:head>

<div class="auth-container" transition:fade>
    <div class="crt-overlay"></div>
    <div class="auth-card">
        <h1 class="header">{$dictionary[$locale].AUTH_PAGE_TITLE}</h1>

        {#if mode === 'PROMPT'}
            <div class="prompt-text">{$dictionary[$locale].AUTH_PROMPT_QUESTION}</div>
            <div class="btn-group">
                <button on:click={() => switchMode('LOGIN')}>{$dictionary[$locale].AUTH_BTN_LOGIN_INIT}</button>
                <button on:click={() => switchMode('REGISTER')}>{$dictionary[$locale].AUTH_BTN_REGISTER_INIT}</button>
            </div>
        {:else}
            <div class="form">
                <div class="form-title">{t('AUTH_FORM_TITLE_' + mode)}</div>

                <label for="citizen-name">{$dictionary[$locale].AUTH_LABEL_NAME}</label>
                <input id="citizen-name" type="text" bind:value={username} autocomplete="off" spellcheck="false" maxlength="15" />

                <label for="citizen-password">{$dictionary[$locale].AUTH_LABEL_PASS}</label>
                <div class="input-wrapper">
                    <input
                            id="citizen-password"
                            type={showPassword ? 'text' : 'password'}
                            bind:value={password}
                    />
                    <button type="button" class="toggle-btn" on:click={() => showPassword = !showPassword}>
                        {showPassword ? $dictionary[$locale].AUTH_BTN_MASK : $dictionary[$locale].AUTH_BTN_SHOW}
                    </button>
                </div>

                {#if mode === 'REGISTER'}
                    <label for="confirm-password">{$dictionary[$locale].AUTH_LABEL_CONFIRM}</label>
                    <div class="input-wrapper" transition:fade={{ duration: 150 }}>
                        <input
                                id="confirm-password"
                                type={showPassword ? 'text' : 'password'}
                                bind:value={confirmPassword}
                        />
                    </div>
                    <p class="field-hint" transition:fade={{ duration: 150 }}>{$dictionary[$locale].REG_PASSWORD_RULES}</p>
                {/if}

                <div class="status-msg">{statusMessage}</div>

                <div class="btn-group">
                    <button on:click={() => handleAuth(mode as 'LOGIN' | 'REGISTER')}>{$dictionary[$locale].AUTH_BTN_EXECUTE}</button>
                    <button on:click={() => switchMode('PROMPT')}>{$dictionary[$locale].AUTH_BTN_BACK}</button>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .auth-container { position: fixed; inset: 0; background: #050505; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: #00ffcc; padding-bottom: 45px; /* Prevent bottom bar overlapping */ }
    .auth-card { border: 1px solid #00ffcc; padding: 40px; width: 100%; max-width: 500px; box-shadow: 0 0 20px rgba(0, 255, 204, 0.1); background: #050505; z-index: 20; }
    .header { font-size: 1.1rem; border-bottom: 1px solid rgba(0, 255, 204, 0.3); padding-bottom: 15px; margin-bottom: 30px; letter-spacing: 2px; text-align: center; }
    .prompt-text, label { font-size: 0.9rem; margin-bottom: 12px; display: block; letter-spacing: 1px; }
    .form-title { margin-bottom: 20px; font-weight: bold; text-decoration: underline; }

    .input-wrapper { display: flex; position: relative; width: 100%; margin-bottom: 20px; }
    .input-wrapper input { margin-bottom: 0; flex-grow: 1; padding-right: 80px; }

    .toggle-btn { position: absolute; right: 5px; top: 50%; transform: translateY(-50%); background: transparent; border: none; color: #00ffcc; font-size: 0.8rem; padding: 5px; cursor: pointer; }
    .toggle-btn:hover { text-shadow: 0 0 8px #00ffcc; background: transparent; box-shadow: none; }

    input { width: 100%; background: transparent; border: 1px solid rgba(0, 255, 204, 0.5); color: #fff; padding: 10px; margin-bottom: 20px; font-family: inherit; outline: none; box-sizing: border-box; }
    input:focus { border-color: #00ffcc; box-shadow: 0 0 10px rgba(0, 255, 204, 0.3); }
    .btn-group { display: flex; flex-direction: column; gap: 15px; }

    button { background: transparent; border: 1px solid #00ffcc; color: #00ffcc; padding: 12px; cursor: pointer; font-family: inherit; font-size: 1rem; transition: all 0.2s; }
    button:hover { background: #00ffcc; color: #000; box-shadow: 0 0 15px #00ffcc; }

    .status-msg { min-height: 20px; color: #ff3333; margin-bottom: 15px; font-size: 0.9rem; white-space: normal; word-wrap: break-word; }
    .field-hint {
        font-size: 0.75rem;
        color: rgba(0, 255, 204, 0.6);
        margin-top: -10px;
        margin-bottom: 20px;
        line-height: 1.3;
    }
    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 2px; pointer-events: none; z-index: 10; }

    @media (max-width: 768px) {
        .auth-card {
            padding: 20px;
            max-width: 90%;
            margin: 10px;
        }
    }
</style>