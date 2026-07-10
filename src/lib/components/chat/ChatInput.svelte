<script lang="ts">
    import { dictionary, locale } from '$lib/i18n';
    import VoicePlayer from '$lib/components/VoicePlayer.svelte';
    import type { ChatMessage } from '$lib/types/domain';
    import { createEventDispatcher } from 'svelte';

    export let replyingToMessage: ChatMessage | null = null;
    export let attachmentBase64: string | null = null;
    export let editingMessageId: number | null = null;
    export let isReadOnce: boolean = false;
    export let inputText: string = '';
    export let sending: boolean = false;
    export let currentTab: 'PUBLIC' | 'GROUP' | 'PRIVATE' = 'PUBLIC';

    const dispatch = createEventDispatcher();

    let attachmentInput: HTMLInputElement;
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

    function getHueClass(cc: number | undefined | null) {
        if (cc == null) return 'hue-optimal';
        if (cc > 300) return 'hue-critical';
        if (cc > 100) return 'hue-warning';
        return 'hue-optimal';
    }

    function handleSend() {
        if (!sending && (inputText.trim() || (attachmentBase64 && attachmentBase64.startsWith('data:audio')))) {
            dispatch('send');
        }
    }
</script>

<div class="chat-input-area">
    {#if replyingToMessage}
        <div class="reply-banner {getHueClass(replyingToMessage.senderAvgCC)}">
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
            {$dictionary[$locale].CHAT_EDITING} <button class="cancel-btn" on:click={() => dispatch('cancelEdit')}>{$dictionary[$locale].CHAT_CANCEL}</button>
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
                on:keydown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button class="send-btn" on:click={handleSend} disabled={sending || (!inputText.trim() && !(attachmentBase64 && attachmentBase64.startsWith('data:audio')))}>
                {editingMessageId ? $dictionary[$locale].CHAT_BTN_UPDATE : $dictionary[$locale].CHAT_BTN_TRANSMIT}
            </button>
        </div>
    </div>
    
    <div class="char-count" class:limit={inputText.length >= 250}>
        {inputText.length} / 250
    </div>
</div>

<style>
    .chat-input-area { padding: 15px 20px; border-top: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); background: rgba(0, 0, 0, 0.5); }
    
    .hue-optimal { color: var(--main-color, #00ffcc); text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5)); }
    .hue-warning { color: #ffaa00; text-shadow: 0 0 5px rgba(255, 170, 0, 0.5); }
    .hue-critical { color: #ff3333; text-shadow: 0 0 5px rgba(255, 51, 51, 0.5); }

    .reply-banner { font-size: 0.8rem; margin-bottom: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border: 1px dashed; padding: 5px 10px; }
    .editing-banner { color: #ffaa00; font-size: 0.8rem; margin-bottom: 10px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border: 1px dashed #ffaa00; padding: 5px 10px; }
    
    .attachment-preview { position: relative; display: inline-block; margin-bottom: 10px; border: 1px solid var(--main-color, #00ffcc); }
    .attachment-preview img { max-height: 100px; display: block; }
    .attachment-preview .cancel-btn { position: absolute; top: 0; right: 0; background: rgba(0,0,0,0.8); padding: 2px 5px; border: none; color: #ff3333; cursor: pointer; }
    .cancel-btn { background: transparent; border: none; color: #ffaa00; cursor: pointer; font-family: inherit; }

    .input-controls { display: flex; gap: 15px; align-items: center; }
    
    .read-once-toggle { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
    .read-once-toggle:hover { box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.3)); }
    .read-once-toggle.active { background: #ffaa00; border-color: #ffaa00; color: #000; box-shadow: 0 0 15px rgba(255, 170, 0, 0.5); }

    .input-row { display: flex; gap: 10px; flex: 1; }
    .input-row input[type="text"] { flex: 1; background: var(--border-color, rgba(0, 255, 204, 0.05)); border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px 15px; font-family: inherit; font-size: 1rem; }
    .input-row input[type="text"]:focus { outline: 1px solid #fff; box-shadow: 0 0 10px rgba(255, 255, 255, 0.2); }
    
    .send-btn { background: var(--main-color, #00ffcc); border: none; color: #000; padding: 10px 20px; cursor: pointer; font-family: inherit; font-weight: bold; font-size: 1rem; transition: all 0.2s; flex-shrink: 0; }
    .send-btn:hover:not(:disabled) { box-shadow: 0 0 15px var(--main-color, #00ffcc); }
    .send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .action-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 10px 15px; cursor: pointer; font-family: inherit; transition: all 0.2s; }
    .action-btn:hover { background: var(--main-color, #00ffcc); color: #000; }
    .attach-btn { height: 45px; margin-right: 5px; }
    .attach-btn.recording { background: #ff3333; color: #fff; border-color: #ff3333; animation: pulse 1s infinite; }

    @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    
    .char-count { text-align: right; font-size: 0.75rem; margin-top: 8px; opacity: 0.7; }
    .char-count.limit { color: #ff3333; font-weight: bold; opacity: 1; }

    @media (max-width: 768px) {
        .input-controls { flex-wrap: wrap; gap: 10px; }
        .read-once-toggle { width: 35px; height: 35px; font-size: 1.2rem; }
        .attach-btn { height: 35px; }
        .input-row { width: 100%; }
        .send-btn { padding: 10px 15px; }
    }
</style>
