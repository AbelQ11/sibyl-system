<script lang="ts">
    import { locale, dictionary } from '$lib/i18n';
    import { fade } from 'svelte/transition';
</script>

<svelte:head>
    <title>SIBYL SYSTEM - Links</title>
</svelte:head>

<div class="links-container" transition:fade>
    <div class="terminal-box">
        <div class="terminal-header">
            <span class="pulse"></span>
            {$dictionary[$locale]?.LINKS_PAGE_TITLE || 'SIBYL_SYS // EXTERNAL_LINKS'}
        </div>
        <div class="terminal-content">
            <p class="sys-msg">{$dictionary[$locale]?.LINKS_MSG_REQ || '>>> SYSTEM.MODULES.ACCESS_REQUESTED'}</p>
            <p class="sys-msg">{$dictionary[$locale]?.LINKS_MSG_AUTH || '>>> AUTHORIZING CITIZEN_ACCESS...'}</p>
            <p class="sys-msg status-ok">{$dictionary[$locale]?.LINKS_MSG_GRANTED || '>>> GRANTED'}</p>

            <div class="links-list">
                <a href="https://github.com/AbelQ11/sibyl-system" target="_blank" rel="noopener noreferrer" class="link-item">
                    <span class="icon">[&lt;/&gt;]</span>
                    <span class="label">{$dictionary[$locale]?.NAV_GITHUB || 'GitHub Repository'}</span>
                </a>
                
                <a href="https://ko-fi.com/kiliotsu" target="_blank" rel="noopener noreferrer" class="link-item">
                    <span class="icon">[K]</span>
                    <span class="label">{$dictionary[$locale]?.NAV_KOFI || 'Ko-fi Support'}</span>
                </a>

                <a href="https://docs.google.com/forms/d/e/1FAIpQLSfxIDPeKN25x_OlKqlWfg1S_o2Cqqhyi3YFq0BBGhdMgaC3Ow/viewform?usp=publish-editor" target="_blank" rel="noopener noreferrer" class="link-item">
                    <span class="icon">[?]</span>
                    <span class="label">{$dictionary[$locale]?.NAV_SUGGESTIONS || 'Submit Suggestions'}</span>
                </a>
            </div>
        </div>
    </div>
</div>

<style>
    .links-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        padding: 20px;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
    }

    .terminal-box {
        width: 100%;
        max-width: 600px;
        border: 1px solid var(--main-color, #00ffcc);
        background: rgba(0, 0, 0, 0.7);
        box-shadow: 0 0 15px var(--main-glow, rgba(0, 255, 204, 0.2)), inset 0 0 10px rgba(0, 255, 204, 0.1);
        display: flex;
        flex-direction: column;
    }

    .terminal-header {
        background: rgba(0, 255, 204, 0.1);
        border-bottom: 1px solid var(--border-color, rgba(0, 255, 204, 0.3));
        padding: 10px 15px;
        font-weight: bold;
        letter-spacing: 2px;
        color: var(--main-color, #00ffcc);
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .pulse {
        width: 10px;
        height: 10px;
        background: var(--main-color, #00ffcc);
        border-radius: 50%;
        box-shadow: 0 0 8px var(--main-color, #00ffcc);
        animation: pulse-anim 2s infinite;
    }

    @keyframes pulse-anim {
        0% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.2); }
        100% { opacity: 1; transform: scale(1); }
    }

    .terminal-content {
        padding: 20px;
    }

    .sys-msg {
        margin: 0 0 8px 0;
        color: rgba(0, 255, 204, 0.7);
        font-size: 0.9rem;
    }

    .status-ok {
        color: #00ff00;
        margin-bottom: 25px;
    }

    .links-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .link-item {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 15px;
        border: 1px dashed var(--main-color, #00ffcc);
        background: rgba(0, 255, 204, 0.05);
        color: var(--main-color, #00ffcc);
        text-decoration: none;
        transition: all 0.3s ease;
        font-size: 1.1rem;
        letter-spacing: 1px;
    }

    .link-item:hover {
        background: rgba(0, 255, 204, 0.15);
        border-style: solid;
        box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.4));
    }

    .icon {
        font-weight: bold;
        opacity: 0.8;
    }

    .heart {
        color: #ff3366;
    }
</style>
