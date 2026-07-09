<script lang="ts">
    import { onMount } from 'svelte';
    import { locale, dictionary } from '$lib/i18n';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';

    let friends: any[] = [];
    let incoming: any[] = [];
    let outgoing: any[] = [];
    let loading = true;
    let targetIdentifier = '';
    let statusMessage = '';
    let statusType: 'SUCCESS' | 'ERROR' = 'SUCCESS';

    async function fetchNetworkData() {
        try {
            const res = await fetch('/api/friends');
            if (res.ok) {
                const data = await res.json();
                friends = data.friends || [];
                incoming = data.incoming || [];
                outgoing = data.outgoing || [];
            }
        } catch (err) {
            console.error('Failed to query network connections:', err);
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchNetworkData();
    });

    async function sendSyncRequest() {
        if (!targetIdentifier) return;
        statusMessage = '';
        try {
            const res = await fetch('/api/friends', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetIdentifier })
            });
            const data = await res.json();
            if (res.ok) {
                statusType = 'SUCCESS';
                statusMessage = $dictionary[$locale][data.code] || 'Sync request sent.';
                targetIdentifier = '';
                fetchNetworkData();
            } else {
                statusType = 'ERROR';
                statusMessage = $dictionary[$locale][data.error] || 'Failed to sync.';
            }
        } catch (err) {
            statusType = 'ERROR';
            statusMessage = 'System connection link failure.';
        }
    }

    async function acceptRequest(requestId: number) {
        try {
            const res = await fetch('/api/friends', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId })
            });
            if (res.ok) {
                statusType = 'SUCCESS';
                statusMessage = $dictionary[$locale].NET_SUCCESS_ACCEPTED;
                fetchNetworkData();
            }
        } catch (err) {
            console.error('Failed to accept sync request:', err);
        }
    }

    async function removeConnection(requestId?: number, friendId?: number) {
        try {
            const res = await fetch('/api/friends', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId, friendId })
            });
            if (res.ok) {
                statusType = 'SUCCESS';
                statusMessage = $dictionary[$locale].NET_SUCCESS_DECLINED;
                fetchNetworkData();
            }
        } catch (err) {
            console.error('Failed to terminate sync connection:', err);
        }
    }

    function getCCInfo(cc: number | null) {
        if (cc === null) {
            return { label: $dictionary[$locale].NET_CC_UNKNOWN, class: 'unknown' };
        }
        if (cc < 100) {
            return { label: `CC: ${cc} - ${$dictionary[$locale].NET_STATUS_STABLE}`, class: 'stable' };
        }
        if (cc < 300) {
            return { label: `CC: ${cc} - ${$dictionary[$locale].NET_STATUS_WARNING}`, class: 'warning' };
        }
        return { label: `CC: ${cc} - ${$dictionary[$locale].NET_STATUS_LETHAL}`, class: 'lethal' };
    }
</script>

<svelte:head>
    <title>{$dictionary[$locale].NET_TITLE}</title>
    <meta name="description" content="Manage your compliance network and citizen synchronization requests." />
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="network-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="main-card card-border">
        <h1 class="header">{$dictionary[$locale].NET_TITLE}</h1>
        <div class="security-level">{$dictionary[$locale].NET_STATUS}</div>

        <div class="sync-form-panel card-border">
            <form on:submit|preventDefault={sendSyncRequest} class="sync-form">
                <label for="identifier">{$dictionary[$locale].NET_SYNC_LABEL}</label>
                <div class="sync-input-row">
                    <input 
                        id="identifier" 
                        type="text" 
                        bind:value={targetIdentifier} 
                        placeholder={$dictionary[$locale].NET_SYNC_PLACEHOLDER}
                        autocomplete="off" 
                        spellcheck="false" 
                    />
                    <button type="submit" class="action-btn">{$dictionary[$locale].NET_SYNC_BTN}</button>
                </div>
                {#if statusMessage}
                    <div class="status-msg" class:success={statusType === 'SUCCESS'} class:error={statusType === 'ERROR'}>
                        {statusMessage}
                    </div>
                {/if}
            </form>
        </div>

        <div class="network-grid">
            <div class="pending-panel card-border">
                <div class="sub-section">
                    <h2 class="section-title">{$dictionary[$locale].NET_INCOMING_TITLE}</h2>
                    {#if loading}
                        <div class="loading-state">RETRIEVING...</div>
                    {:else if incoming.length === 0}
                        <div class="empty-state">{$dictionary[$locale].NET_NO_INCOMING}</div>
                    {:else}
                        <ul class="request-list">
                            {#each incoming as req}
                                <li class="request-item">
                                    <div class="citizen-info">
                                        <div class="avatar-frame">
                                            {#if req.avatar}
                                                <img src={req.avatar} alt={req.username} />
                                            {:else}
                                                <div class="blank-avatar"></div>
                                            {/if}
                                        </div>
                                        <div class="meta">
                                            <span class="username">{req.username.toUpperCase()}</span>
                                            <span class="system-id">{req.citizen_id}</span>
                                        </div>
                                    </div>
                                    <div class="actions">
                                        <button class="accept-btn" on:click={() => acceptRequest(req.requestId)}>
                                            {$dictionary[$locale].NET_BTN_ACCEPT}
                                        </button>
                                        <button class="decline-btn" on:click={() => removeConnection(req.requestId)}>
                                            {$dictionary[$locale].NET_BTN_DECLINE}
                                        </button>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>

                <div class="sub-section border-top">
                    <h2 class="section-title">{$dictionary[$locale].NET_OUTGOING_TITLE}</h2>
                    {#if loading}
                        <div class="loading-state">RETRIEVING...</div>
                    {:else if outgoing.length === 0}
                        <div class="empty-state">{$dictionary[$locale].NET_NO_OUTGOING}</div>
                    {:else}
                        <ul class="request-list">
                            {#each outgoing as req}
                                <li class="request-item">
                                    <div class="citizen-info">
                                        <div class="avatar-frame">
                                            {#if req.avatar}
                                                <img src={req.avatar} alt={req.username} />
                                            {:else}
                                                <div class="blank-avatar"></div>
                                            {/if}
                                        </div>
                                        <div class="meta">
                                            <span class="username">{req.username.toUpperCase()}</span>
                                            <span class="system-id">{req.citizen_id}</span>
                                        </div>
                                    </div>
                                    <div class="actions">
                                        <button class="decline-btn" on:click={() => removeConnection(req.requestId)}>
                                            {$dictionary[$locale].NET_BTN_CANCEL}
                                        </button>
                                    </div>
                                </li>
                            {/each}
                        </ul>
                    {/if}
                </div>
            </div>

            <div class="active-panel card-border">
                <h2 class="section-title">{$dictionary[$locale].NET_ACTIVE_TITLE}</h2>
                {#if loading}
                    <div class="loading-state">RETRIEVING...</div>
                {:else if friends.length === 0}
                    <div class="empty-state">{$dictionary[$locale].NET_NO_ACTIVE}</div>
                {:else}
                    <ul class="friends-list">
                        {#each friends.filter(f => f.role !== 'ADMIN') as friend}
                            {@const ccInfo = getCCInfo(friend.last_cc)}
                            <li class="friend-item">
                                <a href="/citizen/{friend.username}" class="friend-link-container">
                                    <div class="citizen-info">
                                        <div class="avatar-frame">
                                            {#if friend.avatar}
                                                <img src={friend.avatar} alt={friend.username} />
                                            {:else}
                                                <div class="blank-avatar"></div>
                                            {/if}
                                        </div>
                                        <div class="meta">
                                            <span class="username">{friend.username.toUpperCase()}</span>
                                            <span class="system-id">{friend.citizen_id}</span>
                                        </div>
                                    </div>
                                    <div class="cc-status-badge {ccInfo.class}">
                                        {ccInfo.label}
                                    </div>
                                </a>
                                <div class="friend-actions">
                                    <button class="chat-btn" on:click={() => goto(`/chat?private=${friend.id}`)}>
                                        [ SECURE CHAT ]
                                    </button>
                                    <button class="desync-btn" on:click={() => removeConnection(undefined, friend.id)}>
                                        {$dictionary[$locale].NET_BTN_DESYNC}
                                    </button>
                                </div>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </div>
        </div>

        <button class="return-btn" on:click={() => goto('/account')}>
            {$dictionary[$locale].NET_RETURN_BTN}
        </button>
    </div>
</div>

<style>
    .network-container { position: absolute; inset: 0; background: var(--bg-color, #050505); display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: var(--main-color, #00ffcc); padding: 20px; overflow: hidden; }
    .main-card { background: var(--bg-color, #050505); padding: 30px; width: 100%; max-width: 1100px; height: 100%; max-height: 85vh; display: flex; flex-direction: column; box-sizing: border-box; overflow-y: auto; }
    .card-border { border: 1px solid var(--main-color, #00ffcc); box-shadow: 0 0 20px var(--border-color, rgba(0, 255, 204, 0.1)); }
    .header { font-size: 1.1rem; border-bottom: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding-bottom: 15px; margin: 0 0 15px 0; letter-spacing: 2px; font-weight: bold; }
    .security-level { font-size: 0.75rem; color: #ff3333; letter-spacing: 1px; margin-bottom: 25px; text-shadow: 0 0 5px rgba(255, 51, 84, 0.3); }
    
    .sync-form-panel { background: var(--border-color, rgba(0, 255, 204, 0.02)); padding: 20px; margin-bottom: 25px; }
    .sync-form { display: flex; flex-direction: column; gap: 10px; }
    .sync-form label { font-size: 0.85rem; letter-spacing: 1px; }
    .sync-input-row { display: flex; gap: 15px; width: 100%; }
    .sync-input-row input { flex-grow: 1; background: transparent; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.4)); color: #fff; padding: 10px; font-family: inherit; outline: none; }
    .sync-input-row input:focus { border-color: var(--main-color, #00ffcc); }
    .action-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 10px 20px; cursor: pointer; font-family: inherit; font-size: 0.85rem; letter-spacing: 1px; transition: all 0.2s; white-space: nowrap; }
    .action-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 15px var(--main-color, #00ffcc); }
    
    .status-msg { font-size: 0.85rem; margin-top: 5px; }
    .status-msg.success { color: var(--main-color, #00ffcc); text-shadow: 0 0 5px var(--main-color, #00ffcc); }
    .status-msg.error { color: #ff3333; text-shadow: 0 0 5px #ff3333; }

    .network-grid { display: grid; grid-template-columns: 1fr 1.2fr; gap: 25px; flex-grow: 1; overflow-y: auto; margin-bottom: 25px; }
    .pending-panel, .active-panel { background: var(--bg-color, #050505); padding: 20px; display: flex; flex-direction: column; box-sizing: border-box; }
    .border-top { border-top: 1px solid var(--border-color, rgba(0, 255, 204, 0.2)); margin-top: 20px; padding-top: 20px; }
    .sub-section { display: flex; flex-direction: column; }
    .section-title { font-size: 0.85rem; letter-spacing: 1px; font-weight: bold; margin: 0 0 15px 0; color: var(--main-color, #00ffcc); border-bottom: 1px dashed var(--border-color, rgba(0, 255, 204, 0.15)); padding-bottom: 5px; }
    
    .loading-state, .empty-state { font-size: 0.8rem; opacity: 0.6; padding: 20px 0; text-align: center; }
    
    .request-list, .friends-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
    .request-item, .friend-item { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color, rgba(0, 255, 204, 0.15)); padding: 10px; background: var(--border-color, rgba(0, 255, 204, 0.01)); transition: all 0.2s; }
    .request-item:hover, .friend-item:hover { border-color: var(--main-glow, rgba(0, 255, 204, 0.4)); background: var(--border-color, rgba(0, 255, 204, 0.03)); }
    
    .friend-link-container { display: flex; justify-content: space-between; align-items: center; flex-grow: 1; text-decoration: none; color: inherit; gap: 20px; cursor: pointer; }
    .citizen-info { display: flex; align-items: center; gap: 15px; }
    .avatar-frame { width: 36px; height: 36px; border: 1px solid var(--main-color, #00ffcc); background: #111; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .avatar-frame img { width: 100%; height: 100%; object-fit: cover; }
    .blank-avatar { width: 100%; height: 100%; background: var(--main-color, #00ffcc); opacity: 0.25; }
    
    .meta { display: flex; flex-direction: column; gap: 3px; }
    .username { font-size: 0.85rem; font-weight: bold; color: #fff; }
    .system-id { font-size: 0.7rem; opacity: 0.6; }
    
    .actions, .friend-actions { display: flex; gap: 10px; }
    .accept-btn, .decline-btn, .desync-btn, .chat-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 5px 12px; font-size: 0.75rem; cursor: pointer; font-family: inherit; transition: all 0.2s; }
    .accept-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .decline-btn { border-color: #ff3333; color: #ff3333; }
    .decline-btn:hover { background: #ff3333; color: #000; box-shadow: 0 0 10px #ff3333; }
    .desync-btn { border-color: #ffaa00; color: #ffaa00; }
    .desync-btn:hover { background: #ffaa00; color: #000; box-shadow: 0 0 10px #ffaa00; }
    .chat-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-color, #00ffcc); }
    
    .cc-status-badge { font-size: 0.75rem; padding: 4px 8px; border: 1px solid; font-weight: bold; text-align: center; }
    .cc-status-badge.stable { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.05)); }
    .cc-status-badge.warning { border-color: #ff9900; color: #ff9900; background: rgba(255, 153, 0, 0.05); }
    .cc-status-badge.lethal { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.05); animation: blink 1s infinite alternate; }
    .cc-status-badge.unknown { border-color: #777; color: #777; background: rgba(119, 119, 119, 0.05); }

    .return-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 12px; cursor: pointer; font-family: inherit; font-size: 0.95rem; letter-spacing: 2px; transition: all 0.2s; margin-top: auto; }
    .return-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 15px var(--main-color, #00ffcc); }

    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 2px; pointer-events: none; z-index: 10; }

    @keyframes blink {
        from { opacity: 1; }
        to { opacity: 0.4; }
    }

    @media (max-width: 900px) {
        .network-grid { grid-template-columns: 1fr; }
        .network-container { padding: 15px 15px 65px 15px; align-items: flex-start; }
        .main-card { padding: 15px; height: 100%; max-height: 100%; }
        .sync-input-row { flex-direction: column; }
        .action-btn { width: 100%; }
    }
</style>
