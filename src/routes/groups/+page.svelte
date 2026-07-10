<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';
    import { enhance } from '$app/forms';

    export let data: any;
    export let form: any;

    $: groups = data.groups || [];
    $: pendingRequests = data.pendingRequests || [];

    let createMode = false;
    
    let newGroupName = '';
    let newGroupMaxCC = 100;
    
    let searchQuery = '';

    $: isAlreadyInGroup = groups.some((g: any) => g.isMember);
    $: filteredGroups = groups.filter((g: any) => g.name.toLowerCase().includes(searchQuery.toLowerCase()));

    $: if (form?.message) {
        alert(form.message);
        if (form.success) {
            createMode = false;
            newGroupName = '';
        }
    }
    $: if (form?.error) {
        alert(form.error);
    }
</script>

<svelte:head>
    <title>Sibyl System - Divisions Registry</title>
</svelte:head>

<div class="groups-container">
    <div class="header-row">
        <h2>{$dictionary[$locale].GRP_TITLE}</h2>
        {#if !isAlreadyInGroup}
            <button class="create-btn" on:click={() => createMode = !createMode}>
                {createMode ? $dictionary[$locale].GRP_BTN_CANCEL : $dictionary[$locale].GRP_BTN_CREATE}
            </button>
        {/if}
    </div>

    {#if createMode && !isAlreadyInGroup}
        <form class="create-panel" transition:fade method="POST" action="?/create" use:enhance>
            <h3>{$dictionary[$locale].GRP_CREATE_HEADER}</h3>
            <div class="form-group">
                <label>{$dictionary[$locale].GRP_LABEL_NAME}</label>
                <input type="text" name="name" bind:value={newGroupName} placeholder={$dictionary[$locale].GRP_PLACEHOLDER_NAME} maxlength="50" />
            </div>
            <div class="form-group">
                <label>{$dictionary[$locale].GRP_LABEL_MAX_CC}</label>
                <input type="number" name="maxCC" bind:value={newGroupMaxCC} min="0" max="999" />
                <span class="hint">{$dictionary[$locale].GRP_HINT_MAX_CC}</span>
            </div>
            <button class="submit-btn" type="submit">{$dictionary[$locale].GRP_BTN_INIT}</button>
        </form>
    {/if}

    {#if pendingRequests.length > 0}
        <div class="pending-section">
            <h3>{$dictionary[$locale].GRP_PENDING_TITLE}</h3>
            {#each pendingRequests as req}
                <div class="request-card">
                    <span class="req-info">
                        <strong>{req.senderName}</strong> {$dictionary[$locale].GRP_INVITED_YOU} <strong>{req.groupName}</strong> ({$dictionary[$locale].GRP_MAX_CC} {req.maxCC})
                    </span>
                    <form class="req-actions" method="POST" action="?/handleRequest" use:enhance>
                        <input type="hidden" name="requestId" value={req.id} />
                        <button class="accept-btn" name="action" value="ACCEPT" type="submit">{$dictionary[$locale].GRP_BTN_ACCEPT}</button>
                        <button class="decline-btn" name="action" value="DECLINE" type="submit">{$dictionary[$locale].GRP_BTN_DECLINE}</button>
                    </form>
                </div>
            {/each}
        </div>
    {/if}

    <div class="search-section">
        <input type="text" class="search-input" bind:value={searchQuery} placeholder={$dictionary[$locale].GRP_SEARCH_PLACEHOLDER} />
    </div>

    <div class="group-list">
        {#if filteredGroups.length === 0}
            <div class="empty">{$dictionary[$locale].GRP_EMPTY}</div>
        {:else}
            {#each filteredGroups as group}
                <div class="group-card">
                    <div class="group-info">
                        <h3>{group.name}</h3>
                        <span class="cc-limit">{$dictionary[$locale].GRP_LIMIT} {group.maxCC}</span>
                        <span class="members-count">{$dictionary[$locale].GRP_MEMBERS} {group.memberCount || 1}</span>
                    </div>
                    <div class="group-actions">
                        {#if group.isMember}
                            <button class="enter-btn" on:click={() => goto(`/chat?group=${group.id}`)}>
                                {$dictionary[$locale].GRP_BTN_ENTER}
                            </button>
                        {:else}
                            <form method="POST" action="?/join" use:enhance style="display:inline;">
                                <input type="hidden" name="groupId" value={group.id} />
                                <button class="join-btn" type="submit">
                                    {$dictionary[$locale].GRP_BTN_REQUEST}
                                </button>
                            </form>
                        {/if}
                        <button class="details-btn" on:click={() => goto(`/groups/${group.id}`)}>
                            {$dictionary[$locale].GRP_BTN_DETAILS}
                        </button>
                    </div>
                </div>
            {/each}
        {/if}
    </div>
</div>

<style>
    .groups-container {
        max-width: 800px;
        margin: 20px auto;
        font-family: 'Courier New', Courier, monospace;
        color: var(--main-color, #00ffcc);
    }
    .header-row { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--main-color, #00ffcc); padding-bottom: 10px; margin-bottom: 20px; }
    .create-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 5px 15px; cursor: pointer; }
    .create-btn:hover { background: var(--main-color, #00ffcc); color: #000; }

    .create-panel { background: var(--border-color, rgba(0, 255, 204, 0.05)); border: 1px dashed var(--main-color, #00ffcc); padding: 20px; margin-bottom: 20px; }
    .form-group { margin-bottom: 15px; display: flex; flex-direction: column; gap: 5px; }
    input { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px; font-family: inherit; }
    .hint { font-size: 0.8rem; opacity: 0.7; }
    .submit-btn { background: var(--main-color, #00ffcc); color: #000; font-weight: bold; padding: 10px 20px; border: none; cursor: pointer; }

    .group-list { display: flex; flex-direction: column; gap: 15px; }
    .group-card { display: flex; justify-content: space-between; align-items: center; background: rgba(5, 5, 5, 0.8); border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 15px; }
    .group-info { display: flex; flex-direction: column; gap: 5px; }
    .group-info h3 { margin: 0; color: #fff; font-size: 1.1rem; }
    .cc-limit { color: #ffaa00; font-size: 0.9rem; }
    .members-count { color: #888; font-size: 0.8rem; }
    
    .search-section { margin-bottom: 20px; }
    .search-input { width: 100%; padding: 10px; background: var(--border-color, rgba(0, 255, 204, 0.05)); border: 1px solid var(--main-color, #00ffcc); color: #fff; font-family: inherit; font-size: 1.1rem; box-sizing: border-box; }
    .search-input:focus { outline: none; box-shadow: 0 0 10px var(--border-color, rgba(0, 255, 204, 0.2)); }

    .group-actions { display: flex; gap: 10px; }
    .enter-btn, .join-btn, .details-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 5px 10px; font-family: inherit; font-weight: bold; cursor: pointer; transition: all 0.2s; }
    .enter-btn:hover, .join-btn:hover, .details-btn:hover { background: var(--main-color, #00ffcc); color: #000; }

    .pending-section { margin-bottom: 20px; border: 1px dashed #ffaa00; padding: 15px; background: rgba(255, 170, 0, 0.05); }
    .pending-section h3 { color: #ffaa00; margin-top: 0; }
    .request-card { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255, 170, 0, 0.2); padding-bottom: 10px; margin-bottom: 10px; }
    .request-card:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .req-info { color: #eee; }
    .req-actions { display: flex; gap: 10px; }
    .accept-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 5px 10px; cursor: pointer; }
    .accept-btn:hover { background: var(--main-color, #00ffcc); color: #000; }
    .decline-btn { background: transparent; border: 1px solid #ff3333; color: #ff3333; padding: 5px 10px; cursor: pointer; }
    .decline-btn:hover { background: #ff3333; color: #000; }
</style>
