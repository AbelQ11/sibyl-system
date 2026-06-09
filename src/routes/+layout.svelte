<script lang="ts">
    import { currentUser, userAvatar, appMode } from '$lib/stores';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { locale, dictionary } from '$lib/i18n';

    export let data;

    $: if (data?.user) {
        currentUser.set(data.user.username);
        userAvatar.set(data.user.avatar || null);
    }

    $: if (typeof window !== 'undefined' && !$currentUser) {
        const isAuthPage = $page.url.pathname === '/auth';
        const isPublicPage = $page.url.pathname === '/privacy' || $page.url.pathname === '/terms';
        const hasBypassParam = $page.url.searchParams.get('bypass') === 'true';
        const isScanningMode = $page.url.pathname === '/' && ($appMode === 'INITIAL' || $appMode === 'SCANNING');

        if (!isAuthPage && !isPublicPage && !(isScanningMode && hasBypassParam)) {
            goto('/auth');
        }
    }

    function handleLogoClick() {
        if ($currentUser) goto('/');
        else goto('/auth');
    }

    function toggleLanguage() {
        locale.update(l => l === 'EN' ? 'FR' : 'EN');
    }
</script>

<div class="app-wrapper">
    <main class="content-frame">
        <slot />
    </main>

    <nav class="hud-nav">
        <div class="logo" on:click={handleLogoClick} on:keydown={(e) => e.key === 'Enter' && handleLogoClick()} role="button" tabindex="0">
            SIBYL_SYS // v0.0.1
        </div>
        <div class="nav-links">
            <a href="/privacy" class="nav-btn-link">
                {$dictionary[$locale].NAV_PRIVACY || '[ PRIVACY ]'}
            </a>
            <a href="/terms" class="nav-btn-link">
                {$dictionary[$locale].NAV_TERMS || '[ TERMS ]'}
            </a>
            <a href="https://ko-fi.com/kiliotsu" target="_blank" rel="noopener noreferrer" class="nav-btn-link">
                {$dictionary[$locale].NAV_KOFI || '[ KO-FI ]'}
            </a>
            <a href="https://github.com/AbelQ11/sibyl-system" target="_blank" rel="noopener noreferrer" class="nav-btn-link">
                {$dictionary[$locale].NAV_GITHUB || '[ GITHUB ]'}
            </a>
            <button class="lang-toggle-btn" on:click={toggleLanguage}>
                [ {$locale} ]
            </button>
            {#if $currentUser}
                <div class="profile-link" on:click={() => goto('/account')} on:keydown={(e) => e.key === 'Enter' && goto('/account')} role="button" tabindex="0">
                    <div class="nav-avatar">
                        {#if $userAvatar}
                            <img src={$userAvatar} alt="Nav Avatar" />
                        {:else}
                            <div class="blank-nav-avatar"></div>
                        {/if}
                    </div>
                    <span>{$currentUser.toUpperCase()}</span>
                </div>
            {/if}
        </div>
    </nav>
</div>

<style>
    :global(body) { margin: 0; background-color: #050505; overflow: hidden; }
    .app-wrapper { display: flex; flex-direction: column; height: 100vh; position: relative; }
    .content-frame { flex-grow: 1; height: calc(100vh - 45px); position: relative; overflow: hidden; }
    .hud-nav { display: flex; justify-content: space-between; align-items: center; padding: 10px 25px; background: rgba(5, 5, 5, 0.95); border-top: 1px solid rgba(0, 255, 204, 0.25); font-family: 'Courier New', Courier, monospace; color: #00ffcc; z-index: 1000; height: 25px; }
    .logo { cursor: pointer; font-weight: bold; letter-spacing: 2px; text-shadow: 0 0 5px rgba(0, 255, 204, 0.5); }
    .profile-link { display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 4px 8px; border: 1px solid transparent; }
    .profile-link:hover { border-color: #00ffcc; background: rgba(0, 255, 204, 0.05); }
    .nav-avatar { width: 24px; height: 24px; border: 1px solid #00ffcc; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    .nav-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .blank-nav-avatar { width: 100%; height: 100%; background: #00ffcc; opacity: 0.3; }
    .nav-links { display: flex; align-items: center; }
    .lang-toggle-btn {
        background: transparent;
        border: 1px solid rgba(0, 255, 204, 0.4);
        color: #00ffcc;
        padding: 2px 8px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8rem;
        margin-right: 15px;
        transition: all 0.2s;
    }
    .lang-toggle-btn:hover {
        background: rgba(0, 255, 204, 0.1);
        border-color: #00ffcc;
        box-shadow: 0 0 5px rgba(0, 255, 204, 0.3);
    }
    .nav-btn-link {
        text-decoration: none;
        color: #00ffcc;
        border: 1px solid rgba(0, 255, 204, 0.4);
        padding: 2px 8px;
        font-size: 0.8rem;
        margin-right: 15px;
        transition: all 0.2s;
        display: inline-block;
    }
    .nav-btn-link:hover {
        background: rgba(0, 255, 204, 0.1);
        border-color: #00ffcc;
        box-shadow: 0 0 5px rgba(0, 255, 204, 0.3);
    }
</style>