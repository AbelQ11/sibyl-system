<script lang="ts">
    import { currentUser, userAvatar, appMode, globalNotificationsEnabled, latestSSEEvent } from '$lib/stores';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { locale, dictionary } from '$lib/i18n';
    import { fade } from 'svelte/transition';
    import { onMount, onDestroy } from 'svelte';

    export let data;

    $: if (data?.user) {
        currentUser.set(data.user.username);
        userAvatar.set(data.user.avatar || null);
    }

    $: if (typeof window !== 'undefined' && !data?.user) {
        const publicPaths = ['/auth', '/register', '/privacy', '/terms', '/invite', '/auth/mock-discord'];
        const isPublicPath = publicPaths.includes($page.url.pathname) || $page.url.pathname.startsWith('/auth/callback');

        if (!isPublicPath) {
            goto('/auth');
        }
    }

    let menuOpen = false;

    function toggleMenu() {
        menuOpen = !menuOpen;
    }

    function closeMenu() {
        menuOpen = false;
    }

    $: if ($page.url.pathname) {
        closeMenu();
    }

    function handleLogoClick() {
        if ($currentUser) goto('/');
        else goto('/auth');
    }

    function toggleLanguage() {
        locale.update(l => l === 'EN' ? 'FR' : 'EN');
    }

    let eventSource: EventSource;

    onMount(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (localStorage.getItem('sibyl_notifications') === 'true' && Notification.permission === 'granted') {
                globalNotificationsEnabled.set(true);
            }
        }

        if (data?.user) {
            eventSource = new EventSource('/api/chat/stream');
            eventSource.onmessage = (event) => {
                const eventData = JSON.parse(event.data);
                latestSSEEvent.set(eventData);

                if (eventData.type === 'message') {
                    /** Determine if the user is actively viewing this specific discussion */
                    let isViewingDiscussion = false;
                    if (document.hasFocus() && window.location.pathname.startsWith('/chat')) {
                        const url = new URL(window.location.href);
                        if (eventData.message.targetType === 'GROUP' && url.searchParams.get('group') === String(eventData.message.groupId)) {
                            isViewingDiscussion = true;
                        } else if (eventData.message.targetType === 'PRIVATE' && url.searchParams.get('private') === String(eventData.message.senderId)) {
                            isViewingDiscussion = true;
                        } else if (eventData.message.targetType === 'PUBLIC' && !url.searchParams.get('group') && !url.searchParams.get('private')) {
                            isViewingDiscussion = true;
                        }
                    }

                    if ($globalNotificationsEnabled && eventData.message.senderId !== data.user.id && !isViewingDiscussion) {
                        let link = '/chat';
                        if (eventData.message.targetType === 'GROUP') {
                            link = `/chat?group=${eventData.message.groupId}`;
                        } else if (eventData.message.targetType === 'PRIVATE') {
                            link = `/chat?private=${eventData.message.senderId}`;
                        }
                        
                        createNotification(
                            "SIBYL COMMS", 
                            `${eventData.message.senderName}: ${eventData.message.isReadOnce ? '[ENCRYPTED]' : eventData.message.text}`,
                            eventData.message.senderAvatar,
                            link
                        );
                    }
                } else if (eventData.type === 'notification') {
                    if ($globalNotificationsEnabled && eventData.receiverId === data.user.id) {
                        createNotification(eventData.title || "SIBYL SYSTEM", eventData.message, null, eventData.link || null);
                    }
                }
            };

            eventSource.onerror = (error) => {
                console.error("Global SSE Error:", error);
            };
        }
    });

    function createNotification(title: string, body: string, icon?: string | null, link?: string | null) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            const options: any = { body };
            if (icon) {
                options.icon = icon.startsWith('http') || icon.startsWith('data:') 
                    ? icon 
                    : new URL(icon, window.location.origin).href;
            }
            const n = new Notification(title, options);
            n.onclick = () => {
                window.focus();
                n.close();
                if (link) {
                    goto(link);
                }
            };
        } catch (e) {
            console.error("Notification error:", e);
        }
    }

    onDestroy(() => {
        if (eventSource) eventSource.close();
    });
</script>

<div class="app-wrapper">
    <main class="content-frame" class:full-height={$appMode === 'BREATHING'}>
        <slot />
    </main>

    {#if $appMode !== 'BREATHING'}
        <nav class="hud-nav">
            <div class="logo" on:click={handleLogoClick} on:keydown={(e) => e.key === 'Enter' && handleLogoClick()} role="button" tabindex="0">
                SIBYL_SYS
            </div>
            <div class="nav-links">
                <a href="/chat" class="nav-btn-link">
                    {$dictionary[$locale].NAV_CHAT}
                </a>
                <a href="/privacy" class="nav-btn-link">
                    {$dictionary[$locale].NAV_PRIVACY}
                </a>
                <a href="/terms" class="nav-btn-link">
                    {$dictionary[$locale].NAV_TERMS}
                </a>
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSfxIDPeKN25x_OlKqlWfg1S_o2Cqqhyi3YFq0BBGhdMgaC3Ow/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" class="nav-btn-link">
                    {$dictionary[$locale].NAV_SUGGESTIONS}
                </a>
                <a href="https://ko-fi.com/kiliotsu" target="_blank" rel="noopener noreferrer" class="nav-btn-link">
                    {$dictionary[$locale].NAV_KOFI}
                </a>
                <a href="https://github.com/AbelQ11/sibyl-system" target="_blank" rel="noopener noreferrer" class="nav-btn-link">
                    {$dictionary[$locale].NAV_GITHUB}
                </a>
                <a href="/invite" class="nav-btn-link">
                    {$dictionary[$locale].NAV_INVITE}
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
            <button class="burger-btn" class:open={menuOpen} on:click={toggleMenu} aria-label="Open Menu">
                ☰
            </button>
        </nav>
    {/if}

    {#if menuOpen}
        <div class="burger-menu-overlay" transition:fade>
            <div class="crt-overlay"></div>
            <button class="burger-close-btn" on:click={closeMenu}>
                {$dictionary[$locale].NAV_CLOSE}
            </button>
            <div class="burger-menu-content">
                <div class="burger-logo">{$dictionary[$locale].NAV_MODULES}</div>
                
                <a href="/chat" class="burger-link" on:click={closeMenu}>
                    {$dictionary[$locale].NAV_CHAT}
                </a>
                <a href="/privacy" class="burger-link" on:click={closeMenu}>
                    {$dictionary[$locale].NAV_PRIVACY}
                </a>
                <a href="/terms" class="burger-link">
                    {$dictionary[$locale].NAV_TERMS}
                </a>
                <a href="https://docs.google.com/forms/d/e/1FAIpQLSfxIDPeKN25x_OlKqlWfg1S_o2Cqqhyi3YFq0BBGhdMgaC3Ow/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" class="burger-link">
                    {$dictionary[$locale].NAV_SUGGESTIONS}
                </a>
                <a href="https://ko-fi.com/kiliotsu" target="_blank" rel="noopener noreferrer" class="burger-link">
                    {$dictionary[$locale].NAV_KOFI}
                </a>
                <a href="https://github.com/AbelQ11/sibyl-system" target="_blank" rel="noopener noreferrer" class="burger-link">
                    {$dictionary[$locale].NAV_GITHUB}
                </a>
                <a href="/invite" class="burger-link">
                    {$dictionary[$locale].NAV_INVITE}
                </a>
                
                <button class="burger-lang-btn" on:click={toggleLanguage}>
                    [ {$dictionary[$locale].NAV_LANGUAGE}: {$locale} ]
                </button>

                {#if $currentUser}
                    <div class="burger-profile-box" on:click={() => goto('/account')} on:keydown={(e) => e.key === 'Enter' && goto('/account')} role="button" tabindex="0">
                        <div class="burger-avatar">
                            {#if $userAvatar}
                                <img src={$userAvatar} alt="Avatar" />
                            {:else}
                                <div class="blank-burger-avatar"></div>
                            {/if}
                        </div>
                        <span class="burger-username">{$currentUser.toUpperCase()}</span>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
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

    .burger-btn {
        display: none;
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 4px 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8rem;
        transition: all 0.2s;
    }
    .burger-btn:hover {
        background: rgba(0, 255, 204, 0.1);
        box-shadow: 0 0 5px #00ffcc;
    }
    .burger-menu-overlay {
        position: fixed;
        inset: 0;
        background: rgba(5, 5, 5, 0.98);
        z-index: 10000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        font-family: 'Courier New', Courier, monospace;
        padding: 30px;
        box-sizing: border-box;
    }
    .burger-menu-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        width: 100%;
        max-width: 400px;
    }
    .burger-logo {
        font-size: 1rem;
        color: #00ffcc;
        font-weight: bold;
        letter-spacing: 2px;
        margin-bottom: 15px;
        text-shadow: 0 0 8px rgba(0, 255, 204, 0.5);
    }
    .burger-link {
        font-size: 1rem;
        text-decoration: none;
        color: #00ffcc;
        border: 1px solid rgba(0, 255, 204, 0.4);
        padding: 10px 20px;
        width: 100%;
        text-align: center;
        box-sizing: border-box;
        transition: all 0.2s;
        letter-spacing: 1.5px;
    }
    .burger-link:hover {
        background: rgba(0, 255, 204, 0.1);
        border-color: #00ffcc;
        box-shadow: 0 0 10px rgba(0, 255, 204, 0.3);
    }
    .burger-lang-btn {
        background: transparent;
        border: 1px solid rgba(0, 255, 204, 0.4);
        color: #00ffcc;
        padding: 10px 20px;
        width: 100%;
        cursor: pointer;
        font-family: inherit;
        font-size: 1rem;
        transition: all 0.2s;
        letter-spacing: 1.5px;
    }
    .burger-lang-btn:hover {
        background: rgba(0, 255, 204, 0.1);
        border-color: #00ffcc;
        box-shadow: 0 0 10px rgba(0, 255, 204, 0.3);
    }
    .burger-close-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        background: transparent;
        border: 1px solid #ff3333;
        color: #ff3333;
        font-size: 0.85rem;
        padding: 5px 12px;
        cursor: pointer;
        font-family: inherit;
        letter-spacing: 1.5px;
        transition: all 0.2s;
    }
    .burger-close-btn:hover {
        background: #ff3333;
        color: #000;
        box-shadow: 0 0 8px #ff3333;
    }
    .burger-profile-box {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        padding: 8px 15px;
        border: 1px dashed rgba(0, 255, 204, 0.4);
        margin-top: 15px;
        width: 100%;
        box-sizing: border-box;
        justify-content: center;
    }
    .burger-profile-box:hover {
        border-color: #00ffcc;
        background: rgba(0, 255, 204, 0.05);
    }
    .burger-avatar {
        width: 28px;
        height: 28px;
        border: 1px solid #00ffcc;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .burger-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    .blank-burger-avatar {
        width: 100%;
        height: 100%;
        background: #00ffcc;
        opacity: 0.3;
    }
    .burger-username {
        color: #fff;
        font-weight: bold;
        font-size: 0.95rem;
        letter-spacing: 1px;
    }
    .content-frame.full-height {
        height: 100vh;
    }

    @media (max-width: 768px) {
        .hud-nav {
            position: fixed;
            top: 50%;
            right: 15px;
            transform: translateY(-50%);
            background: transparent;
            border: none;
            z-index: 9999;
            width: auto;
            height: auto;
            padding: 0;
            box-shadow: none;
            pointer-events: none;
        }
        .content-frame {
            height: 100vh;
        }
        .logo {
            display: none;
        }
        .nav-links {
            display: none;
        }
        .burger-btn {
            display: block;
            background: transparent;
            border: none;
            color: #00ffcc;
            padding: 8px;
            font-size: 2.2rem;
            text-shadow: 0 0 10px rgba(0, 255, 204, 0.7);
            cursor: pointer;
            pointer-events: auto;
            line-height: 1;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), color 0.2s ease, text-shadow 0.2s ease;
        }
        .burger-btn.open {
            transform: rotate(90deg);
        }
        .burger-btn:hover, .burger-btn:active {
            color: #fff;
            text-shadow: 0 0 20px #00ffcc;
            background: transparent;
            box-shadow: none;
        }
    }
</style>