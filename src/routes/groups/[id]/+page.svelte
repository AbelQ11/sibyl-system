<script lang="ts">
    import { onMount } from 'svelte';
    import { dictionary, locale } from '$lib/i18n';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';

    let group: any = null;
    let roster: any[] = [];
    let avgCC: string = '0.0';
    let loading = true;
    let error = '';
    let isMember = false;
    let isEnforcer = false;

    export let data: any;
    const currentUser = data?.user;

    let editBioMode = false;
    let editMaxCCMode = false;
    let editNameMode = false;
    let newBio = '';
    let newMaxCC = 100;
    let newName = '';
    
    /** 'roster' | 'invites' */
    let activeTab = 'roster';
    
    let friends: any[] = [];
    let pendingGroupRequests: any[] = [];
    let selectedFriendToInvite: number | null = null;
    let inviteDropdownOpen = false;

    const groupId = $page.params.id;

    onMount(async () => {
        await loadGroup();
    });

    async function loadGroup() {
        loading = true;
        try {
            const res = await fetch(`/api/group/${groupId}`);
            if (res.ok) {
                const d = await res.json();
                group = d.group;
                roster = d.roster;
                avgCC = d.avgCC;
                newBio = group.bio || '';
                newMaxCC = group.maxCC || 100;
                newName = group.name || '';
                isMember = roster.some((m: any) => m.id === currentUser.id);
                isEnforcer = roster.some((m: any) => m.id === currentUser.id && m.role === 'ENFORCER');
            } else {
                error = $dictionary[$locale].GRP_DET_ERR_LOAD;
            }
        } catch(e) {
            error = $dictionary[$locale].GRP_DET_ERR_NET;
        }

        try {
            const res = await fetch('/api/friends');
            if (res.ok) {
                const d = await res.json();
                friends = d.friends || [];
            }
        } catch (e) {}

        if (currentUser.role === 'ADMIN' || currentUser.id === group?.inspectorId) {
            try {
                const res = await fetch(`/api/group/${groupId}/requests`);
                if (res.ok) {
                    const d = await res.json();
                    pendingGroupRequests = d.requests || [];
                }
            } catch (e) {}
        }

        loading = false;
    }

    async function saveGroupSettings() {
        try {
            const res = await fetch(`/api/group/${groupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bio: newBio, maxCC: newMaxCC, name: newName })
            });
            if (res.ok) {
                group.bio = newBio;
                group.maxCC = newMaxCC;
                group.name = newName;
                editBioMode = false;
                editMaxCCMode = false;
                editNameMode = false;
            } else {
                alert($dictionary[$locale].GRP_DET_ERR_SET);
            }
        } catch(e) {}
    }

    async function inviteFriend() {
        if (!selectedFriendToInvite) return;
        try {
            const res = await fetch('/api/chat/group/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: parseInt(groupId), friendId: selectedFriendToInvite })
            });
            if (res.ok) {
                alert($dictionary[$locale].GRP_DET_MSG_INVITE);
                inviteDropdownOpen = false;
                selectedFriendToInvite = null;
            } else {
                const d = await res.json();
                alert(d.error);
            }
        } catch (e) {}
    }

    /** Avatar Upload Logic */
    let fileInput: HTMLInputElement;

    function triggerUpload() {
        if (currentUser.role === 'ADMIN' || currentUser.id === group.inspectorId) {
            fileInput.click();
        }
    }

    function handleFileChange(event: Event) {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = async (e) => {
            const base64Avatar = e.target?.result as string;
            await uploadAvatar(base64Avatar);
        };
        reader.readAsDataURL(file);
    }

    async function uploadAvatar(base64Avatar: string) {
        try {
            const res = await fetch('/api/group/save-avatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ avatar: base64Avatar, groupId: parseInt(groupId) })
            });
            if (res.ok) {
                group.avatar = base64Avatar;
            } else {
                alert($dictionary[$locale].GRP_DET_ERR_AVATAR);
            }
        } catch (e) {
            alert($dictionary[$locale].GRP_DET_ERR_UP);
        }
    }

    function getHueClass(cc: number) {
        if (cc > 300) return 'hue-critical';
        if (cc > 100) return 'hue-warning';
        return 'hue-optimal';
    }

    async function changeRole(memberId: number, action: 'PROMOTE' | 'DEMOTE') {
        if (!confirm(action === 'PROMOTE' ? $dictionary[$locale].GRP_DET_CONF_PROMOTE : $dictionary[$locale].GRP_DET_CONF_DEMOTE)) return;
        try {
            const res = await fetch(`/api/group/${groupId}/members`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: memberId, action })
            });
            if (res.ok) {
                await loadGroup();
            } else {
                const d = await res.json();
                alert(d.error || $dictionary[$locale].GRP_DET_ERR_ROLE);
            }
        } catch(e) {}
    }

    async function kickMember(memberId: number) {
        if (!confirm($dictionary[$locale].GRP_DET_CONF_KICK)) return;
        try {
            const res = await fetch(`/api/group/${groupId}/members`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: memberId })
            });
            if (res.ok) {
                await loadGroup();
            } else {
                const d = await res.json();
                alert(d.error || $dictionary[$locale].GRP_DET_ERR_KICK);
            }
        } catch(e) {}
    }

    async function joinGroup() {
        try {
            const res = await fetch('/api/chat/group', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'JOIN', groupId: parseInt(groupId) })
            });
            const data = await res.json();
            if (res.ok) {
                alert($dictionary[$locale].GRP_DET_MSG_JOIN);
                await loadGroup();
            } else {
                alert(data.error);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function disbandGroup() {
        if (!confirm($dictionary[$locale].GRP_DET_CONF_DISBAND)) return;
        try {
            const res = await fetch(`/api/group/${groupId}`, { method: 'DELETE' });
            if (res.ok) {
                alert($dictionary[$locale].GRP_DET_MSG_DISBAND);
                goto('/groups');
            } else {
                const d = await res.json();
                alert(d.error);
            }
        } catch (e) {}
    }

    async function revokeInvite(requestId: number) {
        if (!confirm($dictionary[$locale].GRP_DET_CONF_REVOKE)) return;
        try {
            const res = await fetch(`/api/group/${groupId}/requests`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId })
            });
            if (res.ok) {
                await loadGroup();
            }
        } catch (e) {}
    }
</script>

<svelte:head>
    <title>Sibyl System - Division Comms</title>
</svelte:head>

<div class="group-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="main-card card-border">
        {#if loading}
            <div class="loading-state">{$dictionary[$locale].GRP_DET_SCANNING}</div>
        {:else if error}
            <div class="empty-state">{error}</div>
            <button class="return-btn" on:click={() => goto('/groups')}>{$dictionary[$locale].GRP_DET_RETURN}</button>
        {:else if group}
            <div class="header">
                <div class="title-container">
                    {#if editNameMode}
                        <input type="text" bind:value={newName} class="cc-input" style="width: 250px; font-size: 1.2rem; font-weight: bold; letter-spacing: 2px;" maxlength="50" />
                        <button class="save-btn" on:click={saveGroupSettings}>{$dictionary[$locale].GRP_DET_SAVE}</button>
                        <button class="mini-btn" on:click={() => editNameMode = false}>{$dictionary[$locale].GRP_DET_CANCEL}</button>
                    {:else}
                        <h2>{$dictionary[$locale].GRP_DET_HEADER} {group.name.toUpperCase()}</h2>
                        {#if currentUser?.role === 'ADMIN' || currentUser?.id === group?.inspectorId}
                            <button class="mini-btn" on:click={() => editNameMode = true}>{$dictionary[$locale].GRP_DET_EDIT}</button>
                        {/if}
                    {/if}
                </div>
                <div class="header-actions">
                    {#if currentUser?.role === 'ADMIN' || currentUser?.id === group?.inspectorId}
                        <button class="disband-btn" on:click={disbandGroup}>{$dictionary[$locale].GRP_DET_DISBAND}</button>
                    {/if}
                    {#if isMember}
                        <button class="enter-btn" on:click={() => goto(`/chat?group=${groupId}`)}>{$dictionary[$locale].GRP_DET_ENTER}</button>
                    {:else}
                        <button class="join-btn" on:click={joinGroup}>{$dictionary[$locale].GRP_DET_REQUEST}</button>
                    {/if}
                    <button class="return-btn" on:click={() => goto('/groups')}>{$dictionary[$locale].GRP_DET_RETURN}</button>
                </div>
            </div>

            <div class="group-profile">
                <!-- Avatar Section -->
                <div class="avatar-section">
                    <div 
                        class="group-avatar {currentUser.role === 'ADMIN' || currentUser.id === group.inspectorId ? 'clickable' : ''}" 
                        on:click={triggerUpload}
                    >
                        {#if group.avatar}
                            <img src={group.avatar} alt="Group Avatar" />
                        {:else}
                            <div class="blank-avatar">{$dictionary[$locale].GRP_DET_NO_IMG}</div>
                        {/if}
                        {#if currentUser.role === 'ADMIN' || currentUser.id === group.inspectorId}
                            <div class="upload-overlay">{$dictionary[$locale].GRP_DET_UPLOAD}</div>
                        {/if}
                    </div>
                    <input type="file" accept="image/*" bind:this={fileInput} on:change={handleFileChange} style="display: none;" />
                </div>

                <!-- Info Section -->
                <div class="info-section">
                    <div class="stat-row">
                        <span class="label">{$dictionary[$locale].GRP_DET_MAX_CC}</span>
                        {#if editMaxCCMode}
                            <input type="number" bind:value={newMaxCC} class="cc-input" />
                            <button class="save-btn" on:click={saveGroupSettings}>{$dictionary[$locale].GRP_DET_SAVE}</button>
                            <button class="mini-btn" on:click={() => editMaxCCMode = false}>{$dictionary[$locale].GRP_DET_CANCEL}</button>
                        {:else}
                            <span class="value">{group.maxCC}</span>
                            {#if currentUser.role === 'ADMIN' || currentUser.id === group.inspectorId}
                                <button class="mini-btn" on:click={() => editMaxCCMode = true}>{$dictionary[$locale].GRP_DET_EDIT}</button>
                            {/if}
                        {/if}
                    </div>
                    <div class="stat-row">
                        <span class="label">{$dictionary[$locale].GRP_DET_AVG_CC}</span>
                        <span class="value {getHueClass(parseFloat(avgCC))}">{avgCC}</span>
                    </div>
                    <div class="stat-row">
                        <span class="label">{$dictionary[$locale].GRP_DET_MEMBERS}</span>
                        <span class="value">{roster.length}</span>
                    </div>

                    <div class="bio-section">
                        <div class="bio-header">
                            <span class="label">{$dictionary[$locale].GRP_DET_BIO}</span>
                            {#if currentUser.role === 'ADMIN' || currentUser.id === group.inspectorId}
                                <button class="mini-btn" on:click={() => editBioMode = !editBioMode}>
                                    {editBioMode ? $dictionary[$locale].GRP_DET_CANCEL : $dictionary[$locale].GRP_DET_EDIT}
                                </button>
                            {/if}
                        </div>
                        {#if editBioMode}
                            <textarea bind:value={newBio} maxlength="500"></textarea>
                            <button class="save-btn" on:click={saveGroupSettings}>{$dictionary[$locale].GRP_DET_SAVE_BIO}</button>
                        {:else}
                            <div class="bio-text">
                                {group.bio ? group.bio : $dictionary[$locale].GRP_DET_NO_BIO}
                            </div>
                        {/if}
                    </div>

                    {#if currentUser.role === 'ADMIN' || isMember}
                        <div class="invite-section">
                            <button class="action-btn promote invite-toggle" on:click={() => inviteDropdownOpen = !inviteDropdownOpen}>
                                {$dictionary[$locale].GRP_DET_INVITE_BTN}
                            </button>
                            {#if inviteDropdownOpen}
                                <div class="invite-dropdown" transition:fade>
                                    <select bind:value={selectedFriendToInvite} class="cc-input" style="width: 200px;">
                                        <option value={null}>{$dictionary[$locale].GRP_DET_SELECT_CITIZEN}</option>
                                        {#each friends as friend}
                                            <option value={friend.id}>{friend.username}</option>
                                        {/each}
                                    </select>
                                    <button class="save-btn" on:click={inviteFriend}>{$dictionary[$locale].GRP_DET_CONFIRM_INVITE}</button>
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>

            <!-- Management Section -->
            <div class="management-section">
                {#if currentUser?.role === 'ADMIN' || currentUser?.id === group?.inspectorId}
                    <div class="tabs">
                        <button class="tab-btn {activeTab === 'roster' ? 'active' : ''}" on:click={() => activeTab = 'roster'}>{$dictionary[$locale].GRP_DET_TAB_ROSTER}</button>
                        <button class="tab-btn {activeTab === 'invites' ? 'active' : ''}" on:click={() => activeTab = 'invites'}>{$dictionary[$locale].GRP_DET_TAB_INVITES}</button>
                    </div>
                {:else}
                    <h3>{$dictionary[$locale].GRP_DET_ROSTER}</h3>
                {/if}

                {#if activeTab === 'roster'}
                    <table class="roster-table">
                        <thead>
                            <tr>
                                <th>{$dictionary[$locale].GRP_DET_COL_CITIZEN}</th>
                                <th>{$dictionary[$locale].GRP_DET_COL_SYSID}</th>
                                <th>{$dictionary[$locale].GRP_DET_COL_ROLE}</th>
                                <th>{$dictionary[$locale].GRP_DET_COL_CC}</th>
                                {#if currentUser?.role === 'ADMIN' || currentUser?.id === group?.inspectorId || isEnforcer}
                                    <th>{$dictionary[$locale].GRP_DET_COL_ACTIONS}</th>
                                {/if}
                            </tr>
                        </thead>
                        <tbody>
                            {#each roster as member}
                                <tr>
                                    <td>
                                        <div class="citizen-cell">
                                            <div class="member-avatar">
                                                {#if member.avatar}
                                                    <img src={member.avatar} alt={member.username} />
                                                {/if}
                                            </div>
                                            <span class="username">{member.username.toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td>{member.citizen_id || $dictionary[$locale].GRP_DET_UNKNOWN}</td>
                                    <td>
                                        {#if member.id === group.inspectorId}
                                            <span class="role-badge inspector">{$dictionary[$locale].GRP_DET_ROLE_INSPECTOR}</span>
                                        {:else if member.role === 'ENFORCER'}
                                            <span class="role-badge enforcer">{$dictionary[$locale].GRP_DET_ROLE_ENFORCER}</span>
                                        {:else}
                                            <span class="role-badge citizen">{$dictionary[$locale].GRP_DET_ROLE_CITIZEN}</span>
                                        {/if}
                                    </td>
                                    <td class={getHueClass(member.cc)}>{member.cc ? member.cc.toFixed(1) : '---'}</td>
                                    {#if currentUser?.role === 'ADMIN' || currentUser?.id === group?.inspectorId || isEnforcer}
                                        <td>
                                            {#if member.id !== group.inspectorId}
                                                <div class="action-buttons">
                                                    {#if currentUser?.role === 'ADMIN' || currentUser?.id === group?.inspectorId}
                                                        {#if member.role === 'CITIZEN' || !member.role}
                                                            <button class="action-btn promote" on:click={() => changeRole(member.id, 'PROMOTE')}>{$dictionary[$locale].GRP_DET_PROMOTE}</button>
                                                        {:else}
                                                            <button class="action-btn demote" on:click={() => changeRole(member.id, 'DEMOTE')}>{$dictionary[$locale].GRP_DET_DEMOTE}</button>
                                                        {/if}
                                                    {/if}
                                                    <button class="action-btn kick" on:click={() => kickMember(member.id)}>{$dictionary[$locale].GRP_DET_KICK}</button>
                                                </div>
                                            {/if}
                                        </td>
                                    {/if}
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                {:else if activeTab === 'invites'}
                    <table class="roster-table">
                        <thead>
                            <tr>
                                <th>{$dictionary[$locale].GRP_DET_COL_CITIZEN}</th>
                                <th>{$dictionary[$locale].GRP_DET_COL_SYSID}</th>
                                <th>{$dictionary[$locale].GRP_DET_COL_ACTIONS}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each pendingGroupRequests as req}
                                <tr>
                                    <td><span class="username">{req.username.toUpperCase()}</span></td>
                                    <td>{req.citizen_id || $dictionary[$locale].GRP_DET_UNKNOWN}</td>
                                    <td>
                                        <button class="action-btn kick" on:click={() => revokeInvite(req.id)}>{$dictionary[$locale].GRP_DET_REVOKE}</button>
                                    </td>
                                </tr>
                            {:else}
                                <tr><td colspan="3" class="empty">{$dictionary[$locale].GRP_DET_NO_INVITES}</td></tr>
                            {/each}
                        </tbody>
                    </table>
                {/if}
            </div>

        {/if}
    </div>
</div>

<style>
    .group-container { position: absolute; inset: 0; background: var(--bg-color, #050505); display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: var(--main-color, #00ffcc); padding: 20px; overflow: hidden; }
    .main-card { background: var(--bg-color, #050505); padding: 30px; width: 100%; max-width: 1000px; height: 100%; max-height: 85vh; display: flex; flex-direction: column; box-sizing: border-box; overflow-y: auto; }
    .card-border { border: 1px solid var(--main-color, #00ffcc); box-shadow: 0 0 20px var(--border-color, rgba(0, 255, 204, 0.1)); }
    
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding-bottom: 15px; margin-bottom: 20px; }
    .title-container { display: flex; align-items: center; gap: 10px; }
    .header h2 { margin: 0; font-size: 1.2rem; letter-spacing: 2px; }
    .header-actions { display: flex; gap: 10px; }
    .return-btn, .join-btn, .enter-btn, .disband-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 5px 15px; font-weight: bold; cursor: pointer; transition: all 0.2s; font-family: inherit; }
    .return-btn:hover, .join-btn:hover, .enter-btn:hover { background: var(--main-color, #00ffcc); color: #000; }
    .disband-btn { border-color: #ff3333; color: #ff3333; }
    .disband-btn:hover { background: #ff3333; color: #000; }

    .group-profile { display: flex; gap: 30px; margin-bottom: 30px; background: var(--border-color, rgba(0, 255, 204, 0.02)); padding: 20px; border: 1px dashed var(--main-color, #00ffcc); }
    
    .avatar-section { flex-shrink: 0; }
    .group-avatar { width: 150px; height: 150px; border: 2px solid var(--main-color, #00ffcc); position: relative; overflow: hidden; background: #000; display: flex; align-items: center; justify-content: center; }
    .group-avatar.clickable { cursor: pointer; }
    .group-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .blank-avatar { color: #555; font-weight: bold; letter-spacing: 2px; }
    .upload-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; font-weight: bold; }
    .group-avatar.clickable:hover .upload-overlay { opacity: 1; }

    .info-section { flex: 1; display: flex; flex-direction: column; gap: 10px; }
    .stat-row { display: flex; align-items: center; gap: 10px; }
    .label { color: #555; font-size: 0.9rem; font-weight: bold; width: 150px; }
    .value { font-size: 1.1rem; font-weight: bold; }

    .bio-section { margin-top: 15px; border-top: 1px dashed #333; padding-top: 15px; display: flex; flex-direction: column; gap: 10px; }
    .bio-header { display: flex; justify-content: space-between; align-items: center; }
    .bio-text { white-space: pre-wrap; word-wrap: break-word; color: #aaa; font-size: 0.95rem; line-height: 1.4; }
    textarea { width: 100%; height: 100px; background: var(--border-color, rgba(0, 255, 204, 0.05)); border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px; font-family: inherit; resize: vertical; }
    .cc-input { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; font-family: inherit; padding: 5px; width: 80px; }
    .save-btn { align-self: flex-start; background: var(--main-color, #00ffcc); color: #000; border: none; padding: 5px 15px; font-weight: bold; cursor: pointer; }
    .mini-btn { background: transparent; border: none; color: #ffaa00; cursor: pointer; font-family: inherit; }

    .invite-section { margin-top: 15px; border-top: 1px dashed #333; padding-top: 15px; display: flex; flex-direction: column; gap: 10px; }
    .invite-dropdown { display: flex; gap: 10px; align-items: center; }

    .management-section { flex: 1; display: flex; flex-direction: column; }
    .tabs { display: flex; gap: 10px; border-bottom: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); margin-bottom: 15px; padding-bottom: 5px; }
    .tab-btn { background: transparent; border: none; color: #555; font-family: inherit; font-weight: bold; cursor: pointer; padding: 5px 10px; font-size: 1rem; }
    .tab-btn:hover { color: #aaa; }
    .tab-btn.active { color: var(--main-color, #00ffcc); text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5)); border-bottom: 2px solid var(--main-color, #00ffcc); }
    
    .roster-table { width: 100%; border-collapse: collapse; text-align: left; }
    .roster-table th { color: #555; font-size: 0.8rem; padding-bottom: 10px; border-bottom: 1px solid var(--border-color, rgba(0, 255, 204, 0.2)); }
    .roster-table td { padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
    
    .citizen-cell { display: flex; align-items: center; gap: 10px; }
    .member-avatar { width: 30px; height: 30px; background: #222; border-radius: 50%; overflow: hidden; border: 1px solid var(--main-color, #00ffcc); display: flex; align-items: center; justify-content: center; }
    .member-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .username { font-weight: bold; color: #fff; }
    
    .role-badge { padding: 2px 5px; font-size: 0.7rem; font-weight: bold; }
    .role-badge.inspector { background: #ffaa00; color: #000; }
    .role-badge.enforcer { background: #ff3333; color: #fff; }
    .role-badge.citizen { background: var(--main-color, #00ffcc); color: #000; }

    .action-buttons { display: flex; gap: 5px; }
    .action-btn { background: transparent; border: 1px solid; font-size: 0.7rem; padding: 3px 8px; cursor: pointer; font-family: inherit; font-weight: bold; }
    .action-btn.promote { border-color: #ffaa00; color: #ffaa00; }
    .action-btn.promote:hover { background: #ffaa00; color: #000; }
    .action-btn.demote { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); }
    .action-btn.demote:hover { background: var(--main-color, #00ffcc); color: #000; }
    .action-btn.kick { border-color: #555; color: #555; }
    .action-btn.kick:hover { background: #ff3333; color: #000; border-color: #ff3333; }
    
    .invite-toggle { border-color: var(--main-color, #00ffcc) !important; color: var(--main-color, #00ffcc) !important; padding: 10px !important; }
    .invite-toggle:hover { background: var(--main-color, #00ffcc) !important; color: #000 !important; }

    .hue-optimal { color: var(--main-color, #00ffcc); text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5)); }
    .hue-warning { color: #ffaa00; text-shadow: 0 0 5px rgba(255, 170, 0, 0.5); }
    .hue-critical { color: #ff3333; text-shadow: 0 0 5px rgba(255, 51, 51, 0.5); }
</style>
