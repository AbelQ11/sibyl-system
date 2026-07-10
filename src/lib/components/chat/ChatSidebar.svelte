<script lang="ts">
    import { dictionary, locale } from '$lib/i18n';
    import type { ChatGroup, UserProfile } from '$lib/types/domain';

    export let isSidebarOpen: boolean = false;
    export let currentTab: 'PUBLIC' | 'GROUP' | 'PRIVATE' = 'PUBLIC';
    export let targetId: number | null = null;
    export let groups: ChatGroup[] = [];
    export let friends: UserProfile[] = [];

    function closeSidebar() {
        isSidebarOpen = false;
    }
</script>

<!-- SIDEBAR OVERLAY -->
{#if isSidebarOpen}
    <div class="sidebar-overlay" on:click={closeSidebar}></div>
{/if}

<!-- SIDEBAR -->
<div class="sidebar" class:open={isSidebarOpen}>
    <h3 class="sidebar-title">{$dictionary[$locale].CHAT_CHANNELS}</h3>
    
    <div class="sidebar-section">
        <div class="section-header">{$dictionary[$locale].CHAT_PUBLIC}</div>
        <a href="/chat" class="channel-btn" class:active={currentTab === 'PUBLIC'} on:click={closeSidebar}>
            # {$dictionary[$locale].CHAT_GLOBAL}
        </a>
    </div>

    <div class="sidebar-section">
        <h4 class="section-header">{$dictionary[$locale].CHAT_DIVISIONS}</h4>
        {#if groups.length > 0}
            {#each groups as group}
            <a href={`/chat?group=${group.id}`} class="channel-btn" class:active={currentTab === 'GROUP' && targetId === group.id} on:click={closeSidebar}>
                # {group.name}
            </a>
            {/each}
        {/if}
        {#if groups.length === 0}
            <div class="empty-list">{$dictionary[$locale].CHAT_NO_DIVISIONS}</div>
        {/if}
    </div>

    <div class="sidebar-section">
        <h4 class="section-header">{$dictionary[$locale].CHAT_SECURE_PRIVATE}</h4>
        {#if friends.length > 0}
            {#each friends as f}
            <a href={`/chat?private=${f.id}`} class="channel-btn" class:active={currentTab === 'PRIVATE' && targetId === f.id} on:click={closeSidebar}>
                @ <span class={f.role === 'ADMIN' ? 'blurred' : ''}>{f.role === 'ADMIN' ? 'XXXXXXXXXX' : f.username.toUpperCase()}</span>
            </a>
            {/each}
        {/if}
        {#if friends.length === 0}
            <div class="empty-list">{$dictionary[$locale].CHAT_NO_CONNECTIONS}</div>
        {/if}
    </div>
</div>

<style>
    .sidebar {
        width: 250px;
        border-right: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3));
        display: flex;
        flex-direction: column;
        padding: 15px;
        background: var(--border-color, rgba(0, 255, 204, 0.02));
        overflow-y: auto;
        overflow-x: hidden;
        box-sizing: border-box;
    }
    .sidebar-title { margin: 0 0 20px 0; font-size: 1.2rem; letter-spacing: 1px; }
    .sidebar-section { margin-bottom: 20px; }
    .section-header { font-size: 0.8rem; color: #555; margin-bottom: 10px; border-bottom: 1px dashed #333; padding-bottom: 5px; }
    
    .channel-btn {
        display: block;
        width: 100%;
        box-sizing: border-box;
        text-align: left;
        background: transparent;
        border: 1px solid transparent;
        color: var(--main-color, #00ffcc);
        padding: 8px 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        transition: all 0.2s;
        text-decoration: none;
    }
    .channel-btn:hover { background: var(--border-color, rgba(0, 255, 204, 0.1)); border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); }
    .channel-btn.active { background: var(--main-color, #00ffcc); color: #000; font-weight: bold; }
    .empty-list { font-size: 0.8rem; color: #666; padding-left: 10px; font-style: italic; }

    .blurred { color: transparent; text-shadow: 0 0 5px rgba(0, 255, 204, 0.8); }

    .sidebar-overlay { display: none; }

    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: 280px;
            height: 100vh;
            max-height: none;
            z-index: 2000;
            background: rgba(5, 5, 5, 0.98);
            border-right: 1px solid var(--main-color, #00ffcc);
            border-bottom: none;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar.open {
            transform: translateX(0);
        }

        .sidebar-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(3px);
            z-index: 1500;
        }
    }
</style>
