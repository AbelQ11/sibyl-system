<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { fade } from 'svelte/transition';
    import { browser } from '$app/environment';
    import { globalNotificationsEnabled, latestSSEEvent } from '$lib/stores';

    export let data: any;
    const currentUser = data?.user;

    let currentTab: 'PUBLIC' | 'GROUP' | 'PRIVATE' = 'PUBLIC';
    let targetId: number | null = null;
    let targetName: string = '';

    let messages: any[] = [];
    let groups: any[] = [];
    let friends: any[] = [];

    let inputText = '';
    let isReadOnce = false;
    let sending = false;
    
    /** For editing messages */
    let editingMessageId: number | null = null;

    $: {
        const privateId = $page.url.searchParams.get('private');
        const groupId = $page.url.searchParams.get('group');
        
        if (privateId) {
            currentTab = 'PRIVATE';
            targetId = parseInt(privateId);
            const f = friends.find(fr => fr.id === targetId);
            targetName = f ? (f.role === 'ADMIN' ? 'XXXXXXXXXX' : f.username.toUpperCase()) : 'CITIZEN';
        } else if (groupId) {
            currentTab = 'GROUP';
            targetId = parseInt(groupId);
            const g = groups.find(gr => gr.id === targetId);
            targetName = g ? g.name : 'DIVISION';
        } else {
            currentTab = 'PUBLIC';
            targetId = null;
            targetName = 'GLOBAL';
        }
        
        scrollToBottom();
    }

    onMount(async () => {
        /** Fetch historical messages */
        try {
            const res = await fetch('/api/chat/messages');
            if (res.ok) {
                const d = await res.json();
                messages = d.messages || [];
                scrollToBottom();
            }
        } catch (e) {
            console.error("Failed to load historical messages", e);
        }
        try {
            const res = await fetch('/api/chat/group');
            if (res.ok) {
                const d = await res.json();
                groups = d.groups || [];
                if (currentTab === 'GROUP' && targetId) {
                    const g = groups.find(gr => gr.id === targetId);
                    if (g) targetName = g.name;
                }
            }
        } catch(e) {}

        try {
            const res = await fetch('/api/friends');
            if (res.ok) {
                const d = await res.json();
                friends = d.friends || [];
                if (currentTab === 'PRIVATE' && targetId) {
                    const f = friends.find(fr => fr.id === targetId);
                    if (f) targetName = f.role === 'ADMIN' ? 'XXXXXXXXXX' : f.username.toUpperCase();
                }
            }
        } catch(e) {}
    });

    $: if ($latestSSEEvent) {
        const eventData = $latestSSEEvent;
        if (eventData.type === 'message') {
            messages = [...messages, eventData.message];
            scrollToBottom();
        } else if (eventData.type === 'message_deleted') {
            messages = messages.filter(m => {
                if (m.id === eventData.messageId && m.read) return true;
                return m.id !== eventData.messageId;
            });
        } else if (eventData.type === 'message_edited') {
            const idx = messages.findIndex(m => m.id === eventData.message.id);
            if (idx !== -1) {
                messages[idx] = eventData.message;
            }
        }
    }

    async function toggleNotifications() {
        if (!('Notification' in window)) {
            alert("Your browser does not support desktop notifications.");
            return;
        }

        if ($globalNotificationsEnabled) {
            globalNotificationsEnabled.set(false);
            localStorage.setItem('sibyl_notifications', 'false');
        } else {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                globalNotificationsEnabled.set(true);
                localStorage.setItem('sibyl_notifications', 'true');
            } else {
                alert("Permission for notifications was denied.");
            }
        }
    }


    function scrollToBottom() {
        if (!browser) return;
        setTimeout(() => {
            const chatBox = document.querySelector('.chat-history');
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 50);
    }

    async function sendMessage() {
        if (!inputText.trim() || sending) return;
        sending = true;

        if (editingMessageId) {
            try {
                const res = await fetch('/api/chat/edit', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId: editingMessageId, text: inputText })
                });
                if (!res.ok) {
                    const d = await res.json();
                    alert(d.error || 'Failed to edit message');
                } else {
                    inputText = '';
                    editingMessageId = null;
                }
            } catch(e) {}
            sending = false;
            return;
        }

        try {
            const res = await fetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: inputText,
                    targetType: currentTab,
                    targetId: targetId,
                    isReadOnce
                })
            });

            if (!res.ok) {
                const d = await res.json();
                alert(d.error || 'Failed to send message');
            } else {
                inputText = '';
                /** read-once stays toggled according to the user's preference for multiple messages */
            }
        } catch (e) {
            console.error(e);
        } finally {
            sending = false;
        }
    }

    async function deleteMessage(id: number) {
        if (!confirm("Confirm deletion of this record?")) return;
        try {
            await fetch('/api/chat/delete', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: id })
            });
        } catch(e){}
    }

    function startEdit(msg: any) {
        editingMessageId = msg.id;
        inputText = msg.text;
    }

    function cancelEdit() {
        editingMessageId = null;
        inputText = '';
    }

    async function decryptMessage(id: number) {
        const msgIdx = messages.findIndex(m => m.id === id);
        if (msgIdx !== -1) {
            messages[msgIdx].read = true;
            messages = [...messages];
        }

        try {
            await fetch('/api/chat/decrypt', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId: id })
            });
        } catch (e) {
            console.error(e);
        }
    }

    function getHueClass(cc: number) {
        if (cc > 300) return 'hue-critical';
        if (cc > 100) return 'hue-warning';
        return 'hue-optimal';
    }

    /** Filter messages based on tab */
    $: visibleMessages = messages.filter(m => {
        if (currentTab === 'PUBLIC' && !m.groupId && !m.receiverId) return true;
        if (currentTab === 'PRIVATE' && m.receiverId !== null) {
            return (m.senderId === currentUser.id && m.receiverId === targetId) || (m.senderId === targetId && m.receiverId === currentUser.id);
        }
        if (currentTab === 'GROUP' && m.groupId === targetId) return true;
        return false;
    });

</script>

<svelte:head>
    <title>Sibyl System - Secure Comms</title>
</svelte:head>

<div class="chat-layout">
    <!-- SIDEBAR -->
    <div class="sidebar">
        <h3 class="sidebar-title">// CHANNELS</h3>
        
        <div class="sidebar-section">
            <button class="channel-btn" class:active={currentTab === 'PUBLIC'} on:click={() => goto('/chat')}>
                # PUBLIC_GLOBAL
            </button>
        </div>

        <div class="sidebar-section">
            <h4 class="section-header">DIVISIONS</h4>
            {#each groups as group}
                <button class="channel-btn" class:active={currentTab === 'GROUP' && targetId === group.id} on:click={() => goto(`/chat?group=${group.id}`)}>
                    # {group.name.toUpperCase()}
                </button>
            {/each}
            {#if groups.length === 0}
                <div class="empty-list">NO DIVISIONS</div>
            {/if}
        </div>

        <div class="sidebar-section">
            <h4 class="section-header">SECURE PRIVATE</h4>
            {#each friends as f}
                <button class="channel-btn" class:active={currentTab === 'PRIVATE' && targetId === f.id} on:click={() => goto(`/chat?private=${f.id}`)}>
                    @ <span class={f.role === 'ADMIN' ? 'blurred' : ''}>{f.role === 'ADMIN' ? 'XXXXXXXXXX' : f.username.toUpperCase()}</span>
                </button>
            {/each}
            {#if friends.length === 0}
                <div class="empty-list">NO ACTIVE CONNECTIONS</div>
            {/if}
        </div>
    </div>

    <!-- MAIN CHAT AREA -->
    <div class="chat-container">
        <div class="chat-header">
            <h2>
                // SIBYL SECURE COMMS : {currentTab} 
                {#if targetName}
                    {#if currentTab === 'GROUP'}
                        <span class="clickable-group" on:click={() => goto(`/groups/${targetId}`)} title="View Division Details">
                            [ {targetName} ]
                        </span>
                    {:else}
                        [ <span class={targetName === 'XXXXXXXXXX' ? 'blurred' : ''}>{targetName}</span> ]
                    {/if}
                {/if}
            </h2>
            
            <div class="header-actions" style="display: flex; gap: 10px;">
                <button class="action-btn" on:click={toggleNotifications} title="Toggle Desktop Notifications">
                    {$globalNotificationsEnabled ? '[ NOTIFS: ON ]' : '[ NOTIFS: OFF ]'}
                </button>
            </div>
        </div>

        <div class="chat-history">
            {#each visibleMessages as msg (msg.id)}
                <div class="message-row {msg.senderRole === 'ADMIN' ? 'admin-msg' : ''}" transition:fade>
                    {#if msg.senderAvatar}
                        <img src={msg.senderAvatar} alt="avatar" class="chat-avatar" class:clickable-avatar={msg.senderRole !== 'ADMIN'} on:click={() => { if(msg.senderRole !== 'ADMIN') goto('/citizen/' + msg.senderName) }} />
                    {:else}
                        <div class="chat-avatar blank" class:clickable-avatar={msg.senderRole !== 'ADMIN'} on:click={() => { if(msg.senderRole !== 'ADMIN') goto('/citizen/' + msg.senderName) }}></div>
                    {/if}

                    <div class="message-content">
                        <div class="message-meta">
                            {#if msg.senderGroupName && msg.senderGroupId}
                                <span class="group-tag clickable-group" on:click={() => goto(`/groups/${msg.senderGroupId}`)} title="View Division Details">[{msg.senderGroupName}]</span>
                            {:else if msg.senderGroupName}
                                <span class="group-tag">[{msg.senderGroupName}]</span>
                            {/if}
                            <span class="sender-name {getHueClass(msg.senderCC)}" class:blurred={msg.senderRole === 'ADMIN'}>
                                {msg.senderName}
                            </span>
                            {#if msg.senderRole === 'ADMIN'}
                                <span class="admin-badge">[ SIBYL SYSTEM ]</span>
                            {/if}
                            <span class="msg-timestamp">
                                {new Date(msg.created_at.replace(' ', 'T') + (msg.created_at.includes('Z') ? '' : 'Z')).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                {#if msg.is_edited}
                                    <span class="edited-tag">(edited)</span>
                                {/if}
                            </span>
                        </div>
                        
                        {#if msg.isReadOnce && !msg.read}
                            <button class="decrypt-btn" on:click={() => decryptMessage(msg.id)}>
                                <span class="icon-eye">👁</span> [ DECRYPT ]
                            </button>
                        {:else}
                            <div class="message-text {getHueClass(msg.senderCC)}">
                                {msg.text}
                            </div>
                        {/if}
                    </div>

                    {#if msg.senderId === currentUser?.id || currentUser?.role === 'ADMIN'}
                        <div class="message-actions">
                            {#if msg.senderId === currentUser?.id && (!msg.isReadOnce || msg.read)}
                                <button class="mini-btn edit-btn" title="Edit Message" on:click={() => startEdit(msg)}>[E]</button>
                            {/if}
                            <button class="mini-btn delete-btn" title="Delete Message" on:click={() => deleteMessage(msg.id)}>[D]</button>
                        </div>
                    {/if}
                </div>
            {/each}
        </div>

        <div class="chat-input-area">
            {#if editingMessageId}
                <div class="editing-banner">
                    EDITING MESSAGE... <button class="cancel-btn" on:click={cancelEdit}>[ CANCEL ]</button>
                </div>
            {/if}

            <div class="input-controls">
                <button 
                    class="read-once-toggle {isReadOnce ? 'active' : ''}" 
                    on:click={() => isReadOnce = !isReadOnce}
                    title="Toggle Read-Once Self Destruct"
                >
                    {#if isReadOnce}
                        <span class="icon-eye-closed">⚒</span>
                    {:else}
                        <span class="icon-eye-open">👁</span>
                    {/if}
                </button>
                
                <div class="input-row">
                    <input 
                        type="text" 
                        bind:value={inputText} 
                        maxlength="250"
                        placeholder="Transmit message... (Max 250 chars)" 
                        on:keydown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button on:click={sendMessage} disabled={sending || !inputText.trim()}>
                        {editingMessageId ? '[ UPDATE ]' : '[ TRANSMIT ]'}
                    </button>
                </div>
            </div>
            
            <div class="char-count" class:limit={inputText.length >= 250}>
                {inputText.length} / 250
            </div>
        </div>
    </div>
</div>

<style>
    .chat-layout {
        display: flex;
        height: calc(100vh - 100px);
        max-width: 1200px;
        margin: 20px auto;
        background: rgba(5, 5, 5, 0.95);
        border: 1px solid #00ffcc;
        box-shadow: 0 0 20px rgba(0, 255, 204, 0.1);
        font-family: 'Courier New', Courier, monospace;
        color: #00ffcc;
    }

    /* SIDEBAR */
    .sidebar {
        width: 250px;
        border-right: 1px solid rgba(0, 255, 204, 0.3);
        display: flex;
        flex-direction: column;
        padding: 15px;
        background: rgba(0, 255, 204, 0.02);
        overflow-y: auto;
    }
    .sidebar-title { margin: 0 0 20px 0; font-size: 1.2rem; letter-spacing: 1px; }
    .sidebar-section { margin-bottom: 20px; }
    .section-header { font-size: 0.8rem; color: #555; margin-bottom: 10px; border-bottom: 1px dashed #333; padding-bottom: 5px; }
    
    .channel-btn {
        display: block;
        width: 100%;
        text-align: left;
        background: transparent;
        border: 1px solid transparent;
        color: #00ffcc;
        padding: 8px 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        transition: all 0.2s;
    }
    .channel-btn:hover { background: rgba(0, 255, 204, 0.1); border: 1px solid rgba(0, 255, 204, 0.3); }
    .channel-btn.active { background: #00ffcc; color: #000; font-weight: bold; }
    .empty-list { font-size: 0.8rem; color: #666; padding-left: 10px; font-style: italic; }

    /* CHAT CONTAINER */
    .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .chat-header {
        padding: 15px 20px;
        border-bottom: 1px solid rgba(0, 255, 204, 0.3);
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
    }
    .chat-header h2 { margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
    
    .clickable-group { cursor: pointer; transition: color 0.2s; color: #00ffcc; text-decoration: underline; text-underline-offset: 4px; }
    .clickable-group:hover { color: #fff; text-shadow: 0 0 10px #00ffcc; }

    .chat-history { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; }
    
    .action-btn { background: transparent; border: 1px solid #ffaa00; color: #ffaa00; padding: 5px 10px; cursor: pointer; font-size: 0.8rem; }
    .action-btn:hover { background: #ffaa00; color: #000; }

    .invite-dropdown {
        position: absolute; right: 0; top: 100%; margin-top: 10px; background: #050505; border: 1px solid #00ffcc; padding: 10px; display: flex; gap: 10px; z-index: 100; box-shadow: 0 0 15px rgba(0,0,0,0.8);
    }
    .invite-dropdown select { background: transparent; border: 1px solid #00ffcc; color: #fff; padding: 5px; outline: none; }
    .invite-dropdown button { background: #00ffcc; color: #000; border: none; padding: 5px 10px; font-weight: bold; cursor: pointer; }

    .chat-history {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        scrollbar-width: thin;
        scrollbar-color: rgba(0, 255, 204, 0.4) rgba(0, 0, 0, 0.5);
    }

    .chat-history::-webkit-scrollbar {
        width: 8px;
        background: transparent;
    }
    .chat-history::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.5);
        border-left: 1px solid rgba(0, 255, 204, 0.1);
    }
    .chat-history::-webkit-scrollbar-thumb {
        background: rgba(0, 255, 204, 0.4);
        border-radius: 4px;
    }
    .chat-history::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 255, 204, 0.8);
    }

    .message-row { display: flex; gap: 15px; align-items: flex-start; position: relative; }
    .message-row:hover .message-actions { opacity: 1; }
    
    .admin-msg { background: rgba(255, 0, 0, 0.1); padding: 10px; border: 1px dashed #ff3333; }
    
    .chat-avatar { width: 40px; height: 40px; border: 1px solid #00ffcc; object-fit: cover; }
    .chat-avatar.blank { background: rgba(0, 255, 204, 0.2); }
    .clickable-avatar { cursor: pointer; transition: all 0.2s; }
    .clickable-avatar:hover { box-shadow: 0 0 10px #00ffcc; filter: brightness(1.2); }

    .message-content { flex: 1; min-width: 0; }
    .message-meta { margin-bottom: 5px; font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    
    .msg-timestamp { font-size: 0.7rem; color: #555; font-weight: normal; margin-left: 5px; }
    .edited-tag { color: #ffaa00; font-size: 0.65rem; margin-left: 3px; }

    .hue-optimal { color: #00ffcc; text-shadow: 0 0 5px rgba(0, 255, 204, 0.5); }
    .hue-warning { color: #ffaa00; text-shadow: 0 0 5px rgba(255, 170, 0, 0.5); }
    .hue-critical { color: #ff3333; text-shadow: 0 0 5px rgba(255, 51, 51, 0.5); }

    .blurred { filter: blur(4px); user-select: none; }
    .admin-badge { color: #ff3333; font-weight: bold; }
    .group-tag { color: #aaa; }

    .message-text { word-wrap: break-word; white-space: pre-wrap; line-height: 1.4; }
    
    .message-actions { opacity: 0; transition: opacity 0.2s; display: flex; gap: 5px; margin-left: auto; }
    .mini-btn { background: transparent; border: none; cursor: pointer; font-family: inherit; font-size: 0.8rem; font-weight: bold; }
    .edit-btn { color: #ffaa00; } .edit-btn:hover { text-shadow: 0 0 8px #ffaa00; }
    .delete-btn { color: #ff3333; } .delete-btn:hover { text-shadow: 0 0 8px #ff3333; }

    .decrypt-btn { background: transparent; color: #ffaa00; border: 1px solid #ffaa00; padding: 5px 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
    .decrypt-btn:hover { background: #ffaa00; color: #000; box-shadow: 0 0 10px rgba(255, 170, 0, 0.5); }

    .chat-input-area { padding: 15px 20px; border-top: 1px solid rgba(0, 255, 204, 0.3); background: rgba(0, 0, 0, 0.5); }
    
    .editing-banner { color: #ffaa00; font-size: 0.8rem; margin-bottom: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border: 1px dashed #ffaa00; padding: 5px 10px; }
    .cancel-btn { background: transparent; border: none; color: #ffaa00; cursor: pointer; font-family: inherit; }
    .cancel-btn:hover { text-decoration: underline; }

    .input-controls { display: flex; gap: 15px; align-items: center; }
    
    .read-once-toggle { background: transparent; border: 1px solid #00ffcc; color: #00ffcc; width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
    .read-once-toggle:hover { box-shadow: 0 0 10px rgba(0, 255, 204, 0.3); }
    .read-once-toggle.active { background: #ffaa00; border-color: #ffaa00; color: #000; box-shadow: 0 0 15px rgba(255, 170, 0, 0.5); }

    .input-row { display: flex; gap: 10px; flex: 1; }
    .input-row input { flex: 1; background: rgba(0,255,204,0.05); border: 1px solid #00ffcc; color: #fff; padding: 10px 15px; font-family: inherit; font-size: 1rem; }
    .input-row input:focus { outline: none; box-shadow: 0 0 10px rgba(0, 255, 204, 0.3); background: rgba(0,255,204,0.1); }
    .input-row button { background: #00ffcc; color: #000; border: none; padding: 0 20px; font-weight: bold; cursor: pointer; font-family: inherit; letter-spacing: 1px; transition: all 0.2s; }
    .input-row button:hover:not(:disabled) { box-shadow: 0 0 15px rgba(0,255,204,0.5); }
    .input-row button:disabled { background: #333; color: #666; cursor: not-allowed; }
    
    .char-count { text-align: right; font-size: 0.75rem; margin-top: 8px; opacity: 0.7; }
    .char-count.limit { color: #ff3333; font-weight: bold; opacity: 1; }
</style>
