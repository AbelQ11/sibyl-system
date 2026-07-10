<script lang="ts">
    import { dictionary, locale } from '$lib/i18n';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { fade } from 'svelte/transition';
    import { browser } from '$app/environment';
    import { globalNotificationsEnabled, latestSSEEvent } from '$lib/stores';
    import VoicePlayer from '$lib/components/VoicePlayer.svelte';
    import ChatSidebar from '$lib/components/chat/ChatSidebar.svelte';
    import type { UserProfile, ChatMessage, ChatGroup } from '$lib/types/domain';

    export let data: { user: UserProfile };
    const currentUser: UserProfile = data?.user;

    let currentTab: 'PUBLIC' | 'GROUP' | 'PRIVATE' = 'PUBLIC';
    let targetId: number | null = null;
    let targetName: string = 'GLOBAL';
    let isSidebarOpen: boolean = false;

    let messages: (ChatMessage & { read?: boolean; replyToMessage?: ChatMessage })[] = [];
    let groups: ChatGroup[] = [];
    let friends: UserProfile[] = [];

    let inputText = '';
    let isReadOnce = false;
    let sending = false;
    
    /** For editing messages */
    let editingMessageId: number | null = null;
    let replyingToMessage: ChatMessage | null = null;
    let attachmentBase64: string | null = null;
    let attachmentInput: HTMLInputElement;
    let moderationPopupVisible = false;
    let moderationPenaltyStr = '';

    let isRecording = false;
    let mediaRecorder: MediaRecorder | null = null;
    let audioChunks: Blob[] = [];

    async function toggleRecording() {
        if (isRecording) {
            mediaRecorder?.stop();
            isRecording = false;
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) audioChunks.push(e.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());
                
                const reader = new FileReader();
                reader.onload = (evt) => {
                    attachmentBase64 = evt.target?.result as string;
                };
                reader.readAsDataURL(audioBlob);
            };
            
            mediaRecorder.start();
            isRecording = true;
        } catch(e) {
            console.error("Microphone error", e);
            alert("Failed to access microphone. Please check permissions.");
        }
    }

    function showModerationPopup(penaltyText: string) {
        moderationPenaltyStr = penaltyText;
        moderationPopupVisible = true;
        setTimeout(() => moderationPopupVisible = false, 5000);
    }

    let inCall = false;
    let localStream: MediaStream | null = null;
    let peerConnections: Record<number, RTCPeerConnection> = {};
    let remoteStreams: Record<number, MediaStream> = {};
    let activeCallGroup: number | null = null;
    let activeCallPrivate: number | null = null;
    let incomingCallGroup: number | null = null;
    let incomingCallPrivate: number | null = null;
    let pendingOffers: any[] = [];

    const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    async function signalWebRTC(targetId: number | null, signalType: string, signalData: any, targetGroupId: number | null = null) {
        await fetch('/api/webrtc/signal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetId, targetGroupId, signalType, signalData })
        });
    }

    function createPeerConnection(peerId: number) {
        if (peerConnections[peerId]) return peerConnections[peerId];
        const pc = new RTCPeerConnection(iceServers);
        peerConnections[peerId] = pc;
        if (localStream) localStream.getTracks().forEach(track => pc.addTrack(track, localStream!));
        pc.onicecandidate = event => {
            if (event.candidate) signalWebRTC(peerId, 'ice-candidate', event.candidate);
        };
        pc.ontrack = event => {
            remoteStreams[peerId] = event.streams[0];
            remoteStreams = { ...remoteStreams };
        };
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                delete peerConnections[peerId];
                delete remoteStreams[peerId];
                peerConnections = { ...peerConnections };
                remoteStreams = { ...remoteStreams };
            }
        };
        return pc;
    }

    async function joinCall() {
        if (inCall) return;
        if (currentTab === 'GROUP' && Object.keys(peerConnections).length >= 9) {
            alert("Call is full (Limit 10)");
            return;
        }
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            inCall = true;
            activeCallGroup = currentTab === 'GROUP' ? targetId : null;
            activeCallPrivate = currentTab === 'PRIVATE' ? targetId : null;

            for (const offerData of pendingOffers) {
                const { peerId, payload } = offerData;
                const pc = createPeerConnection(peerId);
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                signalWebRTC(peerId, 'answer', answer);
            }
            pendingOffers = [];
            incomingCallGroup = null;
            incomingCallPrivate = null;

            signalWebRTC(currentTab === 'PRIVATE' ? targetId : null, 'join-ping', {}, currentTab === 'GROUP' ? targetId : null);
        } catch (e) {
            console.error("Audio error", e);
            alert("Could not access microphone.");
        }
    }

    function endCall() {
        inCall = false;
        activeCallGroup = null;
        activeCallPrivate = null;
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        Object.values(peerConnections).forEach(pc => pc.close());
        peerConnections = {};
        remoteStreams = {};
        pendingOffers = [];
        signalWebRTC(currentTab === 'PRIVATE' ? targetId : null, 'end-call', {}, currentTab === 'GROUP' ? targetId : null);
    }

    async function handleWebRTCSignal(data: any) {
        const peerId = data.senderId;
        const type = data.signalType;
        const payload = data.signalData;
        const targetGroupId = data.targetGroupId;

        if (peerId === currentUser.id) return;

        if (type === 'join-ping') {
            if (inCall && ((targetGroupId && targetGroupId === activeCallGroup) || (!targetGroupId && peerId === activeCallPrivate))) {
                if (currentTab === 'GROUP' && Object.keys(peerConnections).length >= 9) return;
                const pc = createPeerConnection(peerId);
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                signalWebRTC(peerId, 'offer', offer);
            } else if (!inCall) {
                if (targetGroupId) incomingCallGroup = targetGroupId;
                else incomingCallPrivate = peerId;
            }
        } else if (type === 'offer') {
            if (inCall) {
                if (currentTab === 'GROUP' && Object.keys(peerConnections).length >= 9 && !peerConnections[peerId]) return;
                const pc = createPeerConnection(peerId);
                const isPolite = peerId > currentUser.id;
                const isStable = pc.signalingState === 'stable';
                if (!isStable && !isPolite) return;
                await pc.setRemoteDescription(new RTCSessionDescription(payload));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                signalWebRTC(peerId, 'answer', answer);
            } else {
                pendingOffers.push({ peerId, payload });
                if (targetGroupId) incomingCallGroup = targetGroupId;
                else incomingCallPrivate = peerId;
            }
        } else if (type === 'answer') {
            if (inCall && peerConnections[peerId]) await peerConnections[peerId].setRemoteDescription(new RTCSessionDescription(payload));
        } else if (type === 'ice-candidate') {
            if (inCall && peerConnections[peerId]) await peerConnections[peerId].addIceCandidate(new RTCIceCandidate(payload));
        } else if (type === 'end-call') {
            if (peerConnections[peerId]) {
                peerConnections[peerId].close();
                delete peerConnections[peerId];
                delete remoteStreams[peerId];
                remoteStreams = { ...remoteStreams };
            }
            pendingOffers = pendingOffers.filter(o => o.peerId !== peerId);
            if (Object.keys(peerConnections).length === 0) {
                incomingCallGroup = null;
                incomingCallPrivate = null;
            }
        }
    }

    function bindStream(node: HTMLMediaElement, stream: MediaStream) {
        node.srcObject = stream;
        return {
            update(newStream: MediaStream) { node.srcObject = newStream; }
        };
    }

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
                messages[idx] = { ...messages[idx], ...eventData.message };
                if (eventData.message.text && eventData.message.text.includes('[REDACTED BY SIBYL SYSTEM')) {
                    const match = eventData.message.text.match(/CC PENALTY: \+(\d+)/);
                    showModerationPopup(match ? `+${match[1]}` : 'Unknown');
                }
            }
        } else if (eventData.type === 'reaction') {
            const idx = messages.findIndex(m => m.id === eventData.messageId);
            if (idx !== -1) {
                messages[idx].reactions = eventData.reactions;
                messages = [...messages];
            }
        } else if (eventData.type === 'webrtc_signal') {
            handleWebRTCSignal(eventData);
        }
    }

    async function toggleReaction(messageId: number, emoji: string) {
        try {
            await fetch('/api/chat/react', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId, emoji })
            });
        } catch (e) {
            console.error(e);
        }
    }

    function groupReactions(reactions: any[]) {
        if (!reactions) return {};
        return reactions.reduce((acc, r) => {
            if (!acc[r.emoji]) acc[r.emoji] = [];
            acc[r.emoji].push(r.userId);
            return acc;
        }, {} as Record<string, number[]>);
    }

    async function toggleNotifications() {
        if (!('Notification' in window)) {
            alert($dictionary[$locale].CHAT_ERR_DESKTOP_NOTIFS);
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
                alert($dictionary[$locale].CHAT_ERR_NOTIFS_DENIED);
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
        let sendText = inputText.trim();
        if (!sendText && attachmentBase64 && attachmentBase64.startsWith('data:audio')) {
            sendText = '[ VOICE TRANSMISSION ]';
        }
        if (!sendText || sending) return;
        sending = true;

        if (editingMessageId) {
            try {
                const res = await fetch('/api/chat/edit', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messageId: editingMessageId, text: sendText })
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
                    text: sendText,
                    targetType: currentTab,
                    targetId: targetId,
                    isReadOnce,
                    replyToId: replyingToMessage ? replyingToMessage.id : null,
                    attachment: attachmentBase64
                })
            });

            if (!res.ok) {
                const d = await res.json();
                alert(d.error || 'Failed to send message');
            } else {
                inputText = '';
                replyingToMessage = null;
                attachmentBase64 = null;
                if (attachmentInput) attachmentInput.value = '';
                /** read-once stays toggled according to the user's preference for multiple messages */
            }
        } catch (e) {
            console.error(e);
        } finally {
            sending = false;
        }
    }

    async function deleteMessage(id: number) {
        if (!confirm($dictionary[$locale].CHAT_CONFIRM_DELETE)) return;
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
    <ChatSidebar 
        bind:isSidebarOpen 
        {currentTab} 
        {targetId} 
        {groups} 
        {friends} 
    />

    <!-- MAIN CHAT AREA -->
    <div class="chat-container">
        <div class="chat-header">
            <h2>
                <button class="burger-btn" on:click={() => isSidebarOpen = true}>☰</button>
                {$dictionary[$locale].CHAT_HEADER_PREFIX} {currentTab} 
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
                {#if currentTab === 'GROUP' || currentTab === 'PRIVATE'}
                    {#if inCall}
                        <button class="sys-btn" style="background:#ff3333; color:#fff;" on:click={endCall}>[ HANG UP ({Object.keys(peerConnections).length + 1}) ]</button>
                    {:else if (currentTab === 'GROUP' && incomingCallGroup === targetId) || (currentTab === 'PRIVATE' && incomingCallPrivate === targetId)}
                        <button class="sys-btn" style="background:var(--main-color, #00ffcc); color:#000;" on:click={joinCall}>[ JOIN CALL ]</button>
                    {:else}
                        <button class="action-btn" on:click={joinCall}>[ START CALL ]</button>
                    {/if}
                {/if}

                {#if $globalNotificationsEnabled === null}
                    <button class="sys-btn" on:click={toggleNotifications}>{$dictionary[$locale].CHAT_ENABLE_NOTIFS}</button>
                {/if}

                {#if moderationPopupVisible}
                    <div class="moderation-popup" transition:fade>
                        {$dictionary[$locale].CHAT_MOD_POPUP_TITLE}<br>
                        {$dictionary[$locale].CHAT_MOD_POPUP_DESC} <span style="color: #ffaa00;">{moderationPenaltyStr}</span>
                    </div>
                {/if}

                <button class="action-btn" on:click={toggleNotifications} title="Toggle Desktop Notifications">
                    {$globalNotificationsEnabled ? $dictionary[$locale].CHAT_NOTIFS_ON : $dictionary[$locale].CHAT_NOTIFS_OFF}
                </button>
            </div>
        </div>

        <div style="display: none;">
            {#each Object.entries(remoteStreams) as [peerId, stream] (peerId)}
                <audio autoplay use:bindStream={stream}></audio>
            {/each}
        </div>

        <div class="chat-history">
            {#each visibleMessages as msg (msg.id)}
                <div class="message-row {msg.senderRole === 'ADMIN' ? 'admin-msg' : ''}" transition:fade>
                    <div class="avatar-wrapper {msg.senderAvatarBorder || ''}">
                        {#if msg.senderAvatar}
                            <img src={msg.senderAvatar} alt="avatar" class="chat-avatar" class:clickable-avatar={msg.senderRole !== 'ADMIN'} on:click={() => { if(msg.senderRole !== 'ADMIN') goto('/citizen/' + msg.senderName) }} />
                        {:else}
                            <div class="chat-avatar blank" class:clickable-avatar={msg.senderRole !== 'ADMIN'} on:click={() => { if(msg.senderRole !== 'ADMIN') goto('/citizen/' + msg.senderName) }}></div>
                        {/if}
                    </div>

                    <div class="message-content">
                        <div class="message-meta">
                            {#if msg.senderGroupName && msg.senderGroupId}
                                <span class="group-tag clickable-group" on:click={() => goto(`/groups/${msg.senderGroupId}`)} title="View Division Details">[{msg.senderGroupName}]</span>
                            {:else if msg.senderGroupName}
                                <span class="group-tag">[{msg.senderGroupName}]</span>
                            {/if}
                            <span class="sender-name {getHueClass(msg.senderCC)} {msg.senderNameEffect || ''}" class:blurred={msg.senderRole === 'ADMIN'} data-text={msg.senderName}>
                                {msg.senderName}
                            </span>
                            {#if msg.senderRole === 'ADMIN'}
                                <span class="admin-badge">{$dictionary[$locale].CHAT_ADMIN_BADGE}</span>
                            {/if}
                            <span class="msg-timestamp">
                                {new Date(msg.created_at.replace(' ', 'T') + (msg.created_at.includes('Z') ? '' : 'Z')).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                {#if msg.is_edited}
                                    <span class="edited-tag">{$dictionary[$locale].CHAT_EDITED}</span>
                                {/if}
                            </span>
                        </div>
                        
                        {#if msg.replyToMessage}
                            <div class="reply-block {getHueClass(msg.replyToMessage.senderAvgCC)}">
                                <span class="reply-sender">@{msg.replyToMessage.senderName}</span>
                                {msg.replyToMessage.text.substring(0, 50)}{msg.replyToMessage.text.length > 50 ? '...' : ''}
                            </div>
                        {/if}

                        {#if msg.isReadOnce && !msg.read}
                            <button class="decrypt-btn" on:click={() => decryptMessage(msg.id)}>
                                <span class="icon-eye">👁</span> {$dictionary[$locale].CHAT_DECRYPT}
                            </button>
                        {:else}
                            <div class="message-text {getHueClass(msg.senderCC)}">
                                {msg.text}
                            </div>
                            {#if msg.attachment}
                                {#if msg.attachment.startsWith('data:audio')}
                                    <VoicePlayer src={msg.attachment} />
                                {:else}
                                    <img src={msg.attachment} alt="attachment" class="msg-attachment-img" />
                                {/if}
                            {/if}
                            <div class="reactions">
                                {#each Object.entries(groupReactions(msg.reactions)) as [emoji, users]}
                                    <button class="reaction-pill {users.includes(currentUser?.id) ? 'active' : ''}" on:click={() => toggleReaction(msg.id, emoji)}>
                                        {emoji} {users.length}
                                    </button>
                                {/each}
                                <div class="add-reaction">
                                    <button class="mini-btn react-btn" title="Add Reaction">[+]</button>
                                    <div class="emoji-picker">
                                        {#each ['👍', '❤️', '💀', '👁️'] as emj}
                                            <button on:click={() => toggleReaction(msg.id, emj)}>{emj}</button>
                                        {/each}
                                        <input type="text" class="custom-emoji-input" maxlength="2" placeholder="..." on:keydown={(e) => {
                                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                                toggleReaction(msg.id, e.currentTarget.value.trim());
                                                e.currentTarget.value = '';
                                            }
                                        }} title="Type a custom emoji and press Enter" />
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>

                        <div class="message-actions">
                            {#if (!msg.isReadOnce || msg.read)}
                                <button class="mini-btn reply-btn" title="Reply" on:click={() => replyingToMessage = msg}>{$dictionary[$locale].CHAT_BTN_REPLY}</button>
                            {/if}
                            {#if msg.senderId === currentUser?.id && (!msg.isReadOnce || msg.read)}
                                <button class="mini-btn edit-btn" title="Edit Message" on:click={() => startEdit(msg)}>{$dictionary[$locale].CHAT_BTN_EDIT}</button>
                            {/if}
                            {#if msg.senderId === currentUser?.id || currentUser?.role === 'ADMIN'}
                                <button class="mini-btn delete-btn" title="Delete Message" on:click={() => deleteMessage(msg.id)}>{$dictionary[$locale].CHAT_BTN_DELETE}</button>
                            {/if}
                        </div>
                </div>
            {/each}
        </div>

        <div class="chat-input-area">
            {#if replyingToMessage}
                <div class="reply-banner {getHueClass(replyingToMessage.senderCC)}">
                    {$dictionary[$locale].CHAT_REPLYING_TO} [{replyingToMessage.senderName}]: "{replyingToMessage.text.substring(0, 30)}..." 
                    <button class="cancel-btn" on:click={() => replyingToMessage = null}>{$dictionary[$locale].CHAT_CANCEL}</button>
                </div>
            {/if}
            {#if attachmentBase64}
                <div class="attachment-preview">
                    {#if attachmentBase64.startsWith('data:audio')}
                        <VoicePlayer src={attachmentBase64} />
                    {:else}
                        <img src={attachmentBase64} alt="attachment preview" />
                    {/if}
                    <button class="cancel-btn" on:click={() => { attachmentBase64 = null; if (attachmentInput) attachmentInput.value = ''; }}>{$dictionary[$locale].CHAT_CANCEL}</button>
                </div>
            {/if}
            {#if editingMessageId}
                <div class="editing-banner">
                    {$dictionary[$locale].CHAT_EDITING} <button class="cancel-btn" on:click={cancelEdit}>{$dictionary[$locale].CHAT_CANCEL}</button>
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
                    <input type="file" accept="image/*" bind:this={attachmentInput} style="display:none;" on:change={(e) => {
                        const target = e.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (file) {
                            if (file.size > 4 * 1024 * 1024) {
                                alert($dictionary[$locale].CHAT_ERR_IMG_SIZE);
                                attachmentInput.value = '';
                                return;
                            }
                            const reader = new FileReader();
                            reader.onload = (evt) => attachmentBase64 = evt.target?.result as string;
                            reader.readAsDataURL(file);
                        }
                    }} />
                    <button class="action-btn attach-btn" on:click={() => attachmentInput.click()} title="Attach Image (Max 4MB)">
                        {$dictionary[$locale].CHAT_ATTACH_IMG}
                    </button>
                    {#if currentTab === 'GROUP' || currentTab === 'PRIVATE'}
                        <button class="action-btn attach-btn {isRecording ? 'recording' : ''}" on:click={toggleRecording} title="Record Voice">
                            {isRecording ? '[ STOP ]' : '[ MIC ]'}
                        </button>
                    {/if}
                    <input 
                        type="text" 
                        bind:value={inputText} 
                        maxlength="250"
                        placeholder={$dictionary[$locale].CHAT_INPUT_PLACEHOLDER}
                        on:keydown={(e) => e.key === 'Enter' && sendMessage()}
                    />
                    <button on:click={sendMessage} disabled={sending || (!inputText.trim() && !(attachmentBase64 && attachmentBase64.startsWith('data:audio')))}>
                        {editingMessageId ? $dictionary[$locale].CHAT_BTN_UPDATE : $dictionary[$locale].CHAT_BTN_TRANSMIT}
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
        border: 1px solid var(--main-color, #00ffcc);
        box-shadow: 0 0 20px var(--border-color, rgba(0, 255, 204, 0.1));
        font-family: 'Courier New', Courier, monospace;
        color: var(--main-color, #00ffcc);
    }

    /* SIDEBAR */
    .sidebar {
        width: 250px;
        border-right: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3));
        display: flex;
        flex-direction: column;
        padding: 15px;
        background: var(--border-color, rgba(0, 255, 204, 0.02));
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
        color: var(--main-color, #00ffcc);
        padding: 8px 10px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        transition: all 0.2s;
    }
    .channel-btn:hover { background: var(--border-color, rgba(0, 255, 204, 0.1)); border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); }
    .channel-btn.active { background: var(--main-color, #00ffcc); color: #000; font-weight: bold; }
    .empty-list { font-size: 0.8rem; color: #666; padding-left: 10px; font-style: italic; }

    /* CHAT CONTAINER */
    .chat-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
    }

    .chat-header {
        padding: 15px 20px;
        border-bottom: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3));
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
    }
    .chat-header h2 { margin: 0; font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
    
    .clickable-group { cursor: pointer; transition: color 0.2s; color: var(--main-color, #00ffcc); text-decoration: underline; text-underline-offset: 4px; }
    .clickable-group:hover { color: #fff; text-shadow: 0 0 10px var(--main-color, #00ffcc); }

    .chat-history { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; min-height: 0; -webkit-overflow-scrolling: touch; }
    
    .action-btn { background: transparent; border: 1px solid #ffaa00; color: #ffaa00; padding: 5px 10px; cursor: pointer; font-size: 0.8rem; }
    .action-btn:hover { background: #ffaa00; color: #000; }
    .sys-btn { background: transparent; border: 1px solid #ff3333; color: #ff3333; padding: 5px 10px; cursor: pointer; font-size: 0.8rem; }
    .sys-btn:hover { background: #ff3333; color: #fff; }

    .invite-dropdown {
        position: absolute; right: 0; top: 100%; margin-top: 10px; background: var(--bg-color, #050505); border: 1px solid var(--main-color, #00ffcc); padding: 10px; display: flex; gap: 10px; z-index: 100; box-shadow: 0 0 15px rgba(0,0,0,0.8);
    }
    .invite-dropdown select { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 5px; outline: none; }
    .invite-dropdown button { background: var(--main-color, #00ffcc); color: #000; border: none; padding: 5px 10px; font-weight: bold; cursor: pointer; }

    .chat-history {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 15px;
        scrollbar-width: thin;
        scrollbar-color: var(--main-glow, rgba(0, 255, 204, 0.4)) rgba(0, 0, 0, 0.5);
    }

    .chat-history::-webkit-scrollbar {
        width: 8px;
        background: transparent;
    }
    .chat-history::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.5);
        border-left: 1px solid var(--border-color, rgba(0, 255, 204, 0.1));
    }
    .chat-history::-webkit-scrollbar-thumb {
        background: var(--main-glow, rgba(0, 255, 204, 0.4));
        border-radius: 4px;
    }
    .chat-history::-webkit-scrollbar-thumb:hover {
        background: var(--main-glow, rgba(0, 255, 204, 0.8));
    }

    .message-row { display: flex; gap: 15px; align-items: flex-start; position: relative; }
    .message-row:hover .message-actions { opacity: 1; }
    
    .admin-msg { background: rgba(255, 0, 0, 0.1); padding: 10px; border: 1px dashed #ff3333; }
    
    .chat-avatar { width: 40px; height: 40px; border: 1px solid var(--main-color, #00ffcc); object-fit: cover; }
    .chat-avatar.blank { background: var(--border-color, rgba(0, 255, 204, 0.2)); }
    .clickable-avatar { cursor: pointer; transition: all 0.2s; }
    .clickable-avatar:hover { box-shadow: 0 0 10px var(--main-color, #00ffcc); filter: brightness(1.2); }

    .message-content { flex: 1; min-width: 0; }
    .message-meta { margin-bottom: 5px; font-size: 0.85rem; font-weight: bold; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    
    .msg-timestamp { font-size: 0.7rem; color: #555; font-weight: normal; margin-left: 5px; }
    .edited-tag { color: #ffaa00; font-size: 0.65rem; margin-left: 3px; }

    .hue-optimal { color: var(--main-color, #00ffcc); text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5)); }
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
    .reply-btn { color: var(--main-color, #00ffcc); } .reply-btn:hover { text-shadow: 0 0 8px var(--main-color, #00ffcc); }
    
    .reply-block { font-size: 0.8rem; border-left: 2px solid; padding-left: 10px; margin-bottom: 5px; opacity: 0.8; font-style: italic; }
    .reply-sender { font-weight: bold; margin-right: 5px; }

    .reply-banner { font-size: 0.8rem; margin-bottom: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border: 1px dashed; padding: 5px 10px; }
    
    .attachment-preview { position: relative; display: inline-block; margin-bottom: 10px; border: 1px solid var(--main-color, #00ffcc); }
    .attachment-preview img { max-height: 100px; display: block; }
    .attachment-preview .cancel-btn { position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.8); padding: 2px 5px; border: none; color: #ff3333; cursor: pointer; }

    .msg-attachment-img { max-width: 100%; max-height: 300px; margin-top: 10px; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); border-radius: 4px; }

    .attach-btn { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 0 10px; display: flex; align-items: center; height: 45px; margin-right: 5px; }
    .attach-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.5)); }
    .attach-btn.recording { background: #ff3333; color: #fff; border-color: #ff3333; animation: pulse 1s infinite; }
    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    .msg-attachment-audio { margin-top: 10px; width: 100%; max-width: 300px; outline: none; border-radius: 20px; }

    .reactions { display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap; align-items: center; }
    .reaction-pill { background: rgba(0,0,0,0.5); border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); color: var(--main-color, #00ffcc); padding: 2px 6px; border-radius: 10px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
    .reaction-pill:hover { border-color: var(--main-color, #00ffcc); box-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.3)); }
    .reaction-pill.active { background: var(--border-color, rgba(0, 255, 204, 0.2)); border-color: var(--main-color, #00ffcc); }

    .add-reaction { position: relative; padding-bottom: 5px; }
    .react-btn { color: #888; border: 1px dashed #888; padding: 2px 5px; border-radius: 10px; transition: all 0.2s; }
    .react-btn:hover { color: var(--main-color, #00ffcc); border-color: var(--main-color, #00ffcc); }
    .emoji-picker { display: none; position: absolute; bottom: 100%; left: 0; background: var(--bg-color, #050505); border: 1px solid var(--main-color, #00ffcc); padding: 5px; gap: 5px; z-index: 10; margin-bottom: 0px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.8); }
    .add-reaction:hover .emoji-picker, .add-reaction:focus-within .emoji-picker { display: flex; }
    .emoji-picker button { background: transparent; border: none; font-size: 1.2rem; cursor: pointer; transition: transform 0.2s; }
    .emoji-picker button:hover { transform: scale(1.2); }
    .custom-emoji-input { background: transparent; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); color: #fff; width: 35px; text-align: center; border-radius: 4px; outline: none; font-size: 1rem; }
    .custom-emoji-input:focus { border-color: var(--main-color, #00ffcc); box-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5)); }

    .decrypt-btn { background: transparent; color: #ffaa00; border: 1px solid #ffaa00; padding: 5px 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
    .decrypt-btn:hover { background: #ffaa00; color: #000; box-shadow: 0 0 10px rgba(255, 170, 0, 0.5); }

    .chat-input-area { padding: 15px 20px; border-top: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); background: rgba(0, 0, 0, 0.5); }
    
    .editing-banner { color: #ffaa00; font-size: 0.8rem; margin-bottom: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border: 1px dashed #ffaa00; padding: 5px 10px; }
    .editing-banner button { background: #ffaa00; color: #000; border: none; font-weight: bold; cursor: pointer; padding: 2px 8px; }
    .cancel-btn { background: transparent; border: none; color: #ffaa00; cursor: pointer; font-family: inherit; }
    .cancel-btn:hover { text-decoration: underline; }

    .moderation-popup {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(255, 0, 0, 0.85);
        color: #fff;
        border: 2px solid #ff3333;
        padding: 15px 30px;
        z-index: 2000;
        text-align: center;
        font-weight: bold;
        text-shadow: 0 0 5px #000;
        box-shadow: 0 0 20px #ff3333;
        pointer-events: none;
        backdrop-filter: blur(5px);
    }

    .input-controls { display: flex; gap: 15px; align-items: center; }
    
    .read-once-toggle { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
    .read-once-toggle:hover { box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.3)); }
    .read-once-toggle.active { background: #ffaa00; border-color: #ffaa00; color: #000; box-shadow: 0 0 15px rgba(255, 170, 0, 0.5); }

    .input-row { display: flex; gap: 10px; flex: 1; }
    .input-row input { flex: 1; background: var(--border-color, rgba(0, 255, 204, 0.05)); border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px 15px; font-family: inherit; font-size: 1rem; }
    .input-row input:focus { outline: 1px solid #fff; box-shadow: 0 0 10px rgba(255, 255, 255, 0.2); }
    .send-btn { background: var(--main-color, #00ffcc); border: none; color: #000; padding: 10px 20px; cursor: pointer; font-family: inherit; font-weight: bold; font-size: 1rem; transition: all 0.2s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { box-shadow: 0 0 15px var(--main-color, #00ffcc); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .burger-btn { display: none; background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); font-size: 1.2rem; padding: 5px 10px; cursor: pointer; border-radius: 4px; }
    .sidebar-overlay { display: none; }

    @media (max-width: 768px) {
        .burger-btn { display: block; }
        
        .chat-layout {
            flex-direction: column;
            margin: 0;
            height: calc(100vh - 60px);
            border: none;
            border-top: 1px solid var(--main-color, #00ffcc);
        }
        
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

        .chat-header {
            padding: 10px 15px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .chat-history {
            padding: 10px;
        }
        .chat-avatar {
            width: 30px;
            height: 30px;
        }
        .message-row {
            gap: 10px;
        }
        .input-controls {
            flex-wrap: wrap;
            gap: 10px;
        }
        .read-once-toggle {
            width: 35px;
            height: 35px;
            font-size: 1.2rem;
        }
        .attach-btn {
            height: 35px;
        }
        .input-row {
            width: 100%;
        }
        .send-btn {
            padding: 10px 15px;
        }
        .header-actions {
            flex-wrap: wrap;
        }
    }
    
    .char-count { text-align: right; font-size: 0.75rem; margin-top: 8px; opacity: 0.7; }
    .char-count.limit { color: #ff3333; font-weight: bold; opacity: 1; }
</style>
