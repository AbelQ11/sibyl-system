<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import {appMode, crimeCoefficient, terminalAutoTrigger} from '$lib/stores';

    let videoElement: HTMLVideoElement;
    let scanning = false;

    onMount(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = stream;
        } catch (e) {
            console.error("Camera access denied or not found", e);
        }
    });

    async function runMockScan() {
        scanning = true;
        appMode.set('SCANNING');

        setTimeout(async () => {
            const result = Math.floor(Math.random() * 450);
            crimeCoefficient.set(result);
            scanning = false;
            appMode.set('RESULTS');

            await fetch('/api/save-scan', {
                method: 'POST',
                body: JSON.stringify({ cc: result })
            });
        }, 3000);
    }

    function resetScanner() {
        crimeCoefficient.set(0);
        appMode.set('INITIAL');
    }
</script>

<div class="hud-container" transition:fade>
    <video bind:this={videoElement} autoplay playsinline muted />

    <div class="overlay">
        <div class="scan-grid"></div>

        <div class="crosshairs" class:scanning>
            {#if scanning}
                <div class="locking-notif">LOCKING ON...</div>
            {/if}
        </div>

        <div class="data-box">
            <h3>SIBYL SYSTEM TERMINAL</h3>
            <p>USER: ENFORCEMENT_OFFICER</p>

            {#if $appMode === 'INITIAL'}
                <p>TARGET: WAITING FOR INPUT...</p>
                <hr />
                <p class="cc-display">CC: --</p>
            {:else}
                <p>TARGET: ACQUIRED</p>
                <hr />
                <p class="cc-display">CC: {$crimeCoefficient}</p>
                <p class="status" class:lethal={$crimeCoefficient > 300}>
                    STATUS: {$crimeCoefficient > 300 ? 'LETHAL ELIMINATOR' : ($crimeCoefficient > 100 ? 'PARALYZER' : 'MONITORING')}
                </p>
            {/if}
        </div>

        <div class="action-buttons">
            {#if $appMode === 'INITIAL'}
                <button on:click={runMockScan}>INITIATE BIOMETRIC SCAN</button>
                <button on:click={() => { terminalAutoTrigger.set('EVALUATE'); appMode.set('TERMINAL'); }}>MANUAL TEXT SCAN</button>

            {:else if $appMode === 'RESULTS'}
                {#if $crimeCoefficient > 100}
                    <h3 class="warning-text">STRESS LEVEL ELEVATED. INTERVENTION REQUIRED.</h3>
                    <div class="options-row">
                        <button on:click={() => appMode.set('TERMINAL')}>BEGIN THERAPY SESSION</button>
                        <button on:click={() => appMode.set('BREATHING')}>INITIATE CALMING PROTOCOL</button>
                    </div>
                {:else}
                    <h3 class="safe-text">HUE CLEAR. NO ACTION REQUIRED.</h3>
                    <button on:click={resetScanner}>ACKNOWLEDGE</button>
                {/if}
            {/if}
        </div>
    </div>
</div>

<style>
    .hud-container {
        position: relative;
        height: 100vh;
        background: radial-gradient(circle, #001a1a 0%, #000 100%);
        overflow: hidden;
        font-family: monospace;
    }

    video {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
    }

    .scan-grid {
        position: absolute;
        inset: 0;
        background-image:
                linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px);
        background-size: 50px 50px;
    }

    .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    .data-box {
        position: absolute;
        top: 50px;
        right: 50px;
        background: rgba(0,0,0,0.9);
        padding: 25px;
        border-left: 4px solid #0ff;
        color: #0ff;
        box-shadow: 0 0 20px rgba(0,255,255,0.2);
        z-index: 20;
    }

    .cc-display { font-size: 1.5rem; margin: 10px 0; }
    .lethal { color: #ff0044; text-shadow: 0 0 10px #ff0044; }

    button {
        z-index: 30;
        padding: 15px 40px;
        background: rgba(0,255,255,0.05);
        border: 1px solid #0ff;
        color: #0ff;
        cursor: pointer;
        letter-spacing: 3px;
        transition: all 0.3s;
        margin-top: 50px;
    }

    button:hover { background: rgba(0,255,255,0.2); box-shadow: 0 0 15px #0ff; }

    .crosshairs {
        width: 300px;
        height: 300px;
        border: 1px solid rgba(0, 255, 255, 0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
    }

    .locking-notif {
        position: absolute;
        bottom: -40px;
        color: #f00;
        font-size: 0.8rem;
        animation: blink 0.5s infinite;
    }

    .scanning {
        border: 2px solid #f00;
        box-shadow: 0 0 30px rgba(255, 0, 0, 0.4);
        animation: scan-pulse 1.5s infinite;
    }

    .action-buttons {
        position: absolute;
        bottom: 100px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
        z-index: 30;
    }

    .options-row {
        display: flex;
        gap: 20px;
    }

    .warning-text { color: #ff4444; text-shadow: 0 0 10px #ff4444; margin-bottom: 20px; text-align: center; }
    .safe-text { color: #00ffcc; text-shadow: 0 0 10px #00ffcc; margin-bottom: 20px; text-align: center; }

    button { margin-top: 0; }

    @keyframes scan-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
</style>