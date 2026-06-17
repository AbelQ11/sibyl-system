<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let redirectUri = '';

    onMount(() => {
        const params = new URLSearchParams(window.location.search);
        redirectUri = params.get('redirect_uri') || '/auth/callback/discord';
    });

    function authorizeMock() {
        const url = new URL(redirectUri, window.location.origin);
        url.searchParams.set('code', 'mock_code_1234');
        window.location.href = url.toString();
    }

    function cancelMock() {
        window.location.href = '/account?discord=error';
    }
</script>

<svelte:head>
    <title>Discord - Authorize Sibyl System</title>
</svelte:head>

<div class="discord-mock-container" transition:fade>
    <div class="discord-card">
        <!-- Mock Discord Logo -->
        <div class="discord-logo">
            <svg viewBox="0 0 127.14 96.36" class="logo-svg">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5A52,52,0,0,0,31.42,78,75.46,75.46,0,0,0,95.78,78a52,52,0,0,0,3.31,2.5,68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,48.24,123.6,25.43,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" fill="#5865F2"/>
            </svg>
            <span class="logo-text">Discord</span>
        </div>

        <div class="divider"></div>

        <h1 class="auth-title">An external app is requesting access to your account</h1>
        
        <div class="app-info">
            <div class="avatar-stub">S</div>
            <div class="app-details">
                <span class="app-name">SIBYL SYSTEM NODE</span>
                <span class="app-url">sibyl-system.mooo.com</span>
            </div>
        </div>

        <p class="scope-text">
            This application will be able to:
        </p>
        <ul class="scope-list">
            <li>
                <svg viewBox="0 0 24 24" class="check-icon">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="#3ba55d"/>
                </svg>
                <span>Access your Discord username, avatar, and unique ID</span>
            </li>
        </ul>

        <div class="warning-box">
            <span class="warning-label">MOCK MODE ACTIVE</span>
            <p>No real Discord credentials are detected in the system environment configuration. Proceeding will link your profile to a simulated identity.</p>
        </div>

        <div class="actions">
            <button class="cancel-btn" on:click={cancelMock}>Cancel</button>
            <button class="auth-btn" on:click={authorizeMock}>Authorize</button>
        </div>
    </div>
</div>

<style>
    .discord-mock-container {
        position: fixed;
        inset: 0;
        background: #1e1f22;
        font-family: 'gg sans', 'Noto Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #dbdee1;
        z-index: 1000;
    }
    
    .discord-card {
        background: #2b2d31;
        width: 100%;
        max-width: 480px;
        padding: 32px;
        border-radius: 8px;
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.24);
        box-sizing: border-box;
    }

    .discord-logo {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 20px;
    }

    .logo-svg {
        width: 32px;
        height: 32px;
    }

    .logo-text {
        font-weight: 800;
        font-size: 1.4rem;
        color: #fff;
        letter-spacing: -0.5px;
    }

    .divider {
        height: 1px;
        background: #3f4147;
        margin: 20px 0;
    }

    .auth-title {
        font-size: 1.25rem;
        color: #f2f3f5;
        font-weight: 600;
        text-align: center;
        margin-bottom: 24px;
        line-height: 1.3;
    }

    .app-info {
        display: flex;
        align-items: center;
        gap: 16px;
        background: #1e1f22;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 24px;
    }

    .avatar-stub {
        width: 48px;
        height: 48px;
        background: #5865f2;
        color: #fff;
        font-weight: bold;
        font-size: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
    }

    .app-name {
        display: block;
        font-weight: 700;
        color: #fff;
        font-size: 1rem;
    }

    .app-url {
        display: block;
        font-size: 0.8rem;
        color: #949ba4;
    }

    .scope-text {
        font-size: 0.9rem;
        color: #b5bac1;
        margin-bottom: 12px;
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
    }

    .scope-list {
        list-style: none;
        padding: 0;
        margin: 0 0 24px 0;
    }

    .scope-list li {
        display: flex;
        align-items: center;
        gap: 12px;
        font-size: 0.95rem;
        color: #dbdee1;
    }

    .check-icon {
        width: 20px;
        height: 20px;
    }

    .warning-box {
        background: rgba(240, 178, 50, 0.1);
        border: 1px solid #f0b232;
        border-radius: 4px;
        padding: 12px 16px;
        margin-bottom: 28px;
        font-size: 0.85rem;
        line-height: 1.4;
    }

    .warning-label {
        display: block;
        color: #f0b232;
        font-weight: 700;
        margin-bottom: 4px;
        letter-spacing: 0.5px;
    }

    .actions {
        display: flex;
        justify-content: flex-end;
        gap: 16px;
    }

    button {
        padding: 10px 24px;
        font-size: 0.95rem;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 0.15s ease;
    }

    .cancel-btn {
        background: transparent;
        color: #fff;
    }

    .cancel-btn:hover {
        text-decoration: underline;
    }

    .auth-btn {
        background: #5865F2;
        color: #fff;
    }

    .auth-btn:hover {
        background: #4752c4;
    }
</style>
