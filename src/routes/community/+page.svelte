<script lang="ts">
    import { locale, dictionary } from '$lib/i18n';
    import { fade } from 'svelte/transition';
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';

    export let data: any;
    export let form: any;

    $: users = data.users || [];
    $: query = data.query || '';
    
    let loading = false;
    let statusMessage = '';
    let statusType: 'SUCCESS' | 'ERROR' = 'SUCCESS';

    $: if (form) {
        if (form.success) {
            statusType = 'SUCCESS';
            statusMessage = $dictionary[$locale][String(form.code) as keyof typeof $dictionary[typeof $locale]] || 'Success.';
        } else if (form.error) {
            statusType = 'ERROR';
            statusMessage = $dictionary[$locale][String(form.error) as keyof typeof $dictionary[typeof $locale]] || form.error;
        }
    }

    const currentUserId = data?.user?.id;



    function getPrivacyLabel(privacy: string) {
        if (privacy === 'PRIVATE') return $dictionary[$locale].ACC_PRIVACY_PRIVATE || 'PRIVATE';
        if (privacy === 'FRIENDS') return $dictionary[$locale].ACC_PRIVACY_FRIENDS || 'FRIENDS';
        if (privacy === 'GROUP ONLY') return 'GROUP ONLY';
        if (privacy === 'FRIENDS AND GROUP ONLY') return 'FRIENDS/GROUP ONLY';
        return $dictionary[$locale].ACC_PRIVACY_PUBLIC || 'PUBLIC';
    }
</script>

<svelte:head>
    <title>{$dictionary[$locale].COM_TITLE}</title>
    <meta name="description" content="Search the citizen directory of the Sibyl System." />
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="community-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="main-card card-border">
        <h1 class="header">{$dictionary[$locale].COM_TITLE}</h1>
        <div class="security-level">{$dictionary[$locale].COM_STATUS}</div>

        <form method="GET" class="search-bar" data-sveltekit-keepfocus>
            <input type="text" name="q" bind:value={query} placeholder={$dictionary[$locale].NET_SYNC_PLACEHOLDER} />
            <button type="submit" class="sys-btn">{$dictionary[$locale].NET_SYNC_BTN}</button>
        </form>

        <div class="results-panel card-border">
            {#if loading}
                <div class="loading-state">RETRIEVING ENCRYPTED DIRECTORY LIST...</div>
            {:else if users.length === 0}
                <div class="empty-state">NO CITIZENS MATCHING SEARCH QUERY FOUND.</div>
            {:else}
                <div class="table-container">
                    <table class="community-table">
                        <thead>
                            <tr>
                                <th>{$dictionary[$locale].COM_COL_CITIZEN}</th>
                                <th>{$dictionary[$locale].COM_COL_SYSTEM_ID}</th>
                                <th>{$dictionary[$locale].COM_COL_PRIVACY}</th>
                                <th>{$dictionary[$locale].COM_COL_SYNC}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each users as u}
                                <tr>
                                    <td>
                                        <div class="citizen-cell">
                                            <div class="avatar-frame">
                                                {#if u.avatar}
                                                    <img src={u.avatar} alt={u.username} />
                                                {:else}
                                                    <div class="blank-avatar"></div>
                                                {/if}
                                            </div>
                                            <span class="username">{u.username.toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="system-id">{u.citizen_id || 'SIB-PENDING'}</span>
                                    </td>
                                    <td>
                                        <span class="privacy-badge {u.privacy || 'PRIVATE'}">
                                            {getPrivacyLabel(u.privacy)}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="action-cell">
                                            {#if data?.user?.role === 'ADMIN'}
                                                <button class="inspect-btn" on:click={() => goto(`/citizen/${u.username}`)}>
                                                    {$dictionary[$locale].COM_BTN_INSPECT}
                                                </button>
                                            {:else}
                                                {#if u.requestStatus === 'PENDING'}
                                                    {#if u.requestSenderId === currentUserId}
                                                        <form method="POST" action="/friends?/cancelRequest" use:enhance>
                                                            <input type="hidden" name="requestId" value={u.requestId} />
                                                            <button class="sys-btn cancel-btn">{$dictionary[$locale].NET_BTN_CANCEL}</button>
                                                        </form>
                                                    {:else}
                                                        <div class="action-row">
                                                            <form method="POST" action="/friends?/acceptRequest" use:enhance>
                                                                <input type="hidden" name="requestId" value={u.requestId} />
                                                                <button class="sys-btn action-btn">{$dictionary[$locale].NET_BTN_ACCEPT}</button>
                                                            </form>
                                                            <form method="POST" action="/friends?/declineRequest" use:enhance>
                                                                <input type="hidden" name="requestId" value={u.requestId} />
                                                                <button class="sys-btn cancel-btn">{$dictionary[$locale].NET_BTN_DECLINE}</button>
                                                            </form>
                                                        </div>
                                                    {/if}
                                                {:else if u.requestStatus === 'ACCEPTED'}
                                                    <button class="sys-btn disabled-btn" disabled>{$dictionary[$locale].TRENDS_STATUS_CONNECTED}</button>
                                                {:else}
                                                    <form method="POST" action="/friends?/sendRequest" use:enhance>
                                                        <input type="hidden" name="targetIdentifier" value={u.username} />
                                                        <button class="sys-btn action-btn">{$dictionary[$locale].NET_SYNC_BTN}</button>
                                                    </form>
                                                {/if}
                                            {/if}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
        </div>

        <button class="return-btn" on:click={() => goto('/account')}>
            {$dictionary[$locale].COM_RETURN_BTN}
        </button>
    </div>
</div>

<style>
    .community-container { position: absolute; inset: 0; background: var(--bg-color, #050505); display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: var(--main-color, #00ffcc); padding: 20px; overflow: hidden; }
    .main-card { background: var(--bg-color, #050505); padding: 30px; width: 100%; max-width: 1100px; height: 100%; max-height: 85vh; display: flex; flex-direction: column; box-sizing: border-box; overflow-y: auto; }
    .card-border { border: 1px solid var(--main-color, #00ffcc); box-shadow: 0 0 20px var(--border-color, rgba(0, 255, 204, 0.1)); }
    .header { font-size: 1.1rem; border-bottom: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding-bottom: 15px; margin: 0 0 15px 0; letter-spacing: 2px; font-weight: bold; }
    .security-level { font-size: 0.75rem; color: #ff3333; letter-spacing: 1px; margin-bottom: 25px; text-shadow: 0 0 5px rgba(255, 51, 84, 0.3); }

    .search-form-panel { background: var(--border-color, rgba(0, 255, 204, 0.02)); padding: 20px; margin-bottom: 25px; }
    .search-form { display: flex; flex-direction: column; gap: 10px; }
    .search-form label { font-size: 0.85rem; letter-spacing: 1px; }
    .search-input-row { display: flex; gap: 15px; width: 100%; }
    .search-input-row input { flex-grow: 1; background: transparent; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.4)); color: #fff; padding: 10px; font-family: inherit; outline: none; }
    .search-input-row input:focus { border-color: var(--main-color, #00ffcc); }
    .action-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 10px 20px; cursor: pointer; font-family: inherit; font-size: 0.85rem; letter-spacing: 1px; transition: all 0.2s; white-space: nowrap; }
    .action-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 15px var(--main-color, #00ffcc); }

    .status-msg { font-size: 0.85rem; margin-top: 5px; }
    .status-msg.success { color: var(--main-color, #00ffcc); text-shadow: 0 0 5px var(--main-color, #00ffcc); }
    .status-msg.error { color: #ff3333; text-shadow: 0 0 5px #ff3333; }

    .results-panel { background: var(--bg-color, #050505); padding: 20px; flex-grow: 1; overflow-y: auto; margin-bottom: 25px; display: flex; flex-direction: column; box-sizing: border-box; }
    .loading-state, .empty-state { font-size: 0.85rem; opacity: 0.6; padding: 40px 0; text-align: center; border: 1px dashed var(--border-color, rgba(0, 255, 204, 0.15)); }

    .table-container { width: 100%; overflow-x: auto; }
    .community-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem; }
    .community-table th { padding: 12px; border-bottom: 1px solid var(--main-glow, rgba(0, 255, 204, 0.4)); color: var(--main-color, #00ffcc); font-weight: bold; letter-spacing: 1px; }
    .community-table td { padding: 12px; border-bottom: 1px solid var(--border-color, rgba(0, 255, 204, 0.15)); vertical-align: middle; }
    .community-table tr:hover td { background: var(--border-color, rgba(0, 255, 204, 0.02)); }

    .citizen-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-frame { width: 32px; height: 32px; border: 1px solid var(--main-color, #00ffcc); background: #111; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .avatar-frame img { width: 100%; height: 100%; object-fit: cover; }
    .blank-avatar { width: 100%; height: 100%; background: var(--main-color, #00ffcc); opacity: 0.25; }

    .username { font-weight: bold; color: #fff; }
    .system-id { opacity: 0.85; font-family: monospace; }

    .privacy-badge { font-size: 0.75rem; padding: 2px 6px; border: 1px solid; text-transform: uppercase; font-weight: bold; }
    .privacy-badge.PUBLIC { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.05)); }
    .privacy-badge.FRIENDS, .privacy-badge.\GROUP\ ONLY, .privacy-badge.\FRIENDS\ AND\ GROUP\ ONLY { border-color: #ffaa00; color: #ffaa00; background: rgba(255, 170, 0, 0.05); }
    .privacy-badge.PRIVATE { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.05); }

    .action-cell { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .status-tag { font-size: 0.75rem; font-weight: bold; padding: 2px 6px; border: 1px solid; }
    .status-tag.friend { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.1)); }
    .status-tag.pending { border-color: #ffaa00; color: #ffaa00; background: rgba(255, 170, 0, 0.1); }
    .status-tag.private { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.1); }

    .inspect-btn, .sync-btn, .accept-btn, .decline-btn, .cancel-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 5px 10px; font-size: 0.75rem; cursor: pointer; font-family: inherit; transition: all 0.2s; }
    .inspect-btn:hover, .sync-btn:hover, .accept-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .decline-btn, .cancel-btn { border-color: #ff3333; color: #ff3333; }
    .decline-btn:hover, .cancel-btn:hover { background: #ff3333; color: #000; box-shadow: 0 0 10px #ff3333; }
    .incoming-actions { display: flex; gap: 5px; }

    .return-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 12px; cursor: pointer; font-family: inherit; font-size: 0.95rem; letter-spacing: 2px; transition: all 0.2s; margin-top: auto; text-align: center; }
    .return-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 15px var(--main-color, #00ffcc); }

    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 2px; pointer-events: none; z-index: 10; }

    @media (max-width: 900px) {
        .community-container { padding: 15px 15px 65px 15px; align-items: flex-start; }
        .main-card { padding: 15px; height: 100%; max-height: 100%; }
        .search-input-row { flex-direction: column; }
        .action-btn { width: 100%; }
        .community-table th:nth-child(3), .community-table td:nth-child(3) { display: none; } /* Hide privacy column on mobile */
    }
</style>
