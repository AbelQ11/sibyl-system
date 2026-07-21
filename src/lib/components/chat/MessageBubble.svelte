<script lang="ts">
    import { dictionary, locale } from '$lib/i18n';
    import { goto } from '$app/navigation';
    import VoicePlayer from '$lib/components/VoicePlayer.svelte';
    import type { ChatMessage, UserProfile } from '$lib/types/domain';
    import { createEventDispatcher } from 'svelte';
    import { fade } from 'svelte/transition';

    export let msg: ChatMessage & { read?: boolean; replyToMessage?: ChatMessage };
    export let currentUser: UserProfile;

    const dispatch = createEventDispatcher();

    function getHueClass(cc: number | undefined | null) {
        if (cc == null) return 'hue-optimal';
        if (cc > 300) return 'hue-critical';
        if (cc > 100) return 'hue-warning';
        return 'hue-optimal';
    }

    function groupReactions(reactions: Record<string, string[]> | undefined) {
        if (!reactions) return {};
        /** The format is already Record<string, string[]> from the DB but the old code grouped it. */
        /** Wait, the reactions are usually an array of objects if from DB, but we typed it as Record<string, string[]> in domain.ts. */
        /** Let's assume it's already grouped or handle both. */
        if (Array.isArray(reactions)) {
            return reactions.reduce((acc, r) => {
                if (!acc[r.emoji]) acc[r.emoji] = [];
                acc[r.emoji].push(r.userId);
                return acc;
            }, {} as Record<string, number[]>);
        }
        return reactions;
    }
</script>

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
            <button class="decrypt-btn" on:click={() => dispatch('decrypt', msg.id)}>
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
                    <button class="reaction-pill {users.includes(currentUser?.id) ? 'active' : ''}" on:click={() => dispatch('react', { id: msg.id, emoji })}>
                        {emoji} {users.length}
                    </button>
                {/each}
                <div class="add-reaction">
                    <button class="mini-btn react-btn" title="Add Reaction">[+]</button>
                    <div class="emoji-picker">
                        {#each ['👍', '❤️', '💀', '👁️'] as emj}
                            <button on:click={() => dispatch('react', { id: msg.id, emoji: emj })}>{emj}</button>
                        {/each}
                        <input type="text" class="custom-emoji-input" maxlength="2" placeholder="..." on:keydown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                dispatch('react', { id: msg.id, emoji: e.currentTarget.value.trim() });
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
            <button class="mini-btn reply-btn" title="Reply" on:click={() => dispatch('reply', msg)}>{$dictionary[$locale].CHAT_BTN_REPLY}</button>
        {/if}
        {#if msg.senderId === currentUser?.id && (!msg.isReadOnce || msg.read)}
            <button class="mini-btn edit-btn" title="Edit Message" on:click={() => dispatch('edit', msg)}>{$dictionary[$locale].CHAT_BTN_EDIT}</button>
        {/if}
        {#if currentUser?.role === 'ADMIN'}
            <button class="mini-btn censor-btn" title="Censor Message" on:click={() => dispatch('censor', msg.id)}>[ CENSOR ]</button>
        {/if}
        {#if msg.senderId === currentUser?.id || currentUser?.role === 'ADMIN'}
            <button class="mini-btn delete-btn" title="Delete Message" on:click={() => dispatch('delete', msg.id)}>{$dictionary[$locale].CHAT_BTN_DELETE}</button>
        {/if}
    </div>
</div>

<style>
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
    .clickable-group { cursor: pointer; transition: color 0.2s; color: var(--main-color, #00ffcc); text-decoration: underline; text-underline-offset: 4px; }
    .clickable-group:hover { color: #fff; text-shadow: 0 0 10px var(--main-color, #00ffcc); }

    .message-text { word-wrap: break-word; white-space: pre-wrap; line-height: 1.4; }
    
    .message-actions { opacity: 0; transition: opacity 0.2s; display: flex; gap: 5px; margin-left: auto; }
    .mini-btn { background: transparent; border: none; cursor: pointer; font-family: inherit; font-size: 0.8rem; font-weight: bold; }
    .edit-btn { color: #ffaa00; } .edit-btn:hover { text-shadow: 0 0 8px #ffaa00; }
    .censor-btn { color: #ffaa00; } .censor-btn:hover { text-shadow: 0 0 8px #ffaa00; }
    .delete-btn { color: #ff3333; } .delete-btn:hover { text-shadow: 0 0 8px #ff3333; }
    .reply-btn { color: var(--main-color, #00ffcc); } .reply-btn:hover { text-shadow: 0 0 8px var(--main-color, #00ffcc); }
    
    .reply-block { font-size: 0.8rem; border-left: 2px solid; padding-left: 10px; margin-bottom: 5px; opacity: 0.8; font-style: italic; }
    .reply-sender { font-weight: bold; margin-right: 5px; }

    .msg-attachment-img { max-width: 100%; max-height: 300px; margin-top: 10px; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); border-radius: 4px; }

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
    
    @media (max-width: 768px) {
        .chat-avatar { width: 30px; height: 30px; }
        .message-row { gap: 10px; }
    }
</style>
