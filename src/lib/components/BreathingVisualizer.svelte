<script lang="ts">
    import { appMode, crimeCoefficient, terminalAutoTrigger } from '$lib/stores';
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let phase: 'IN' | 'HOLD' | 'OUT' | 'FINISHED' = 'OUT';
    let timer = 0;
    let initialCC = $crimeCoefficient;
    let displayCC = initialCC;
    let isInitialized = false;

    $: phaseTime = 4 + (initialCC / 120);
    $: targetCycles = Math.max(3, Math.floor(initialCC / 40));
    let currentCycle = 0;

    onMount(() => {
        setTimeout(() => {
            isInitialized = true;
            phase = 'IN';
        }, 100);

        const interval = setInterval(() => {
            if (phase === 'FINISHED') { clearInterval(interval); return; }

            timer++;
            if (timer <= phaseTime) phase = 'IN';
            else if (timer <= phaseTime * 2) phase = 'HOLD';
            else if (timer <= phaseTime * 3) phase = 'OUT';
            else {
                timer = 0;
                currentCycle++;
                if (currentCycle >= targetCycles) phase = 'FINISHED';
            }

            if (displayCC > 99 && Math.random() > 0.6) displayCC -= 1;
        }, 1000);

        return () => clearInterval(interval);
    });

    function rescanText() { terminalAutoTrigger.set('EVALUATE'); appMode.set('TERMINAL'); }
    function rescanBiometric() { appMode.set('INITIAL'); }
</script>

<div class="breathing-session" transition:fade>
    <div class="crt-overlay"></div>

    <div class="status-bar">
        <div class="left">MEDICAL PROTOCOL: 004-B | CYCLE: {currentCycle}/{targetCycles}</div>
        <div class="right">STABILIZATION ACTIVE</div>
    </div>

    <div class="visualizer-container">
        <div class="target-grid"></div>

        {#if phase !== 'FINISHED'}
            <div
                    class="breathing-circle {phase}"
                    style="--duration: {isInitialized ? phaseTime : 0}s"
            >
                <div class="inner-glow"></div>
            </div>

            <div class="instruction {phase}" transition:fade>
                {phase}
            </div>
        {:else}
            <div class="finished-state" transition:fade>
                <h2>TREATMENT CONCLUDED</h2>
                <p>ESTIMATED CC: {displayCC}</p>
                <div class="options-prompt">SELECT RE-EVALUATION METHOD:</div>
                <div class="options-row">
                    <button class="rescan-btn" on:click={rescanBiometric}>[ BIOMETRIC ]</button>
                    <button class="rescan-btn" on:click={rescanText}>[ EMPATHY AI ]</button>
                </div>
            </div>
        {/if}
    </div>

    {#if phase !== 'FINISHED'}
        <div class="cc-monitor">
            <div class="label">LIVE CRIME COEFFICIENT</div>
            <div class="value" class:danger={displayCC > 100}>{displayCC.toString().padStart(3, '0')}</div>
        </div>
    {/if}
</div>

<style>
    .breathing-session {
        position: fixed; inset: 0;
        background: #000; color: #00ffcc;
        font-family: 'Courier New', Courier, monospace;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        overflow: hidden;
    }

    .status-bar {
        position: absolute; top: 20px; width: 90%;
        display: flex; justify-content: space-between;
        border-bottom: 1px solid rgba(0, 255, 204, 0.3);
        font-size: 0.8rem;
    }

    .cc-monitor {
        position: absolute;
        bottom: 40px;
        right: 40px;
        text-align: right;
    }

    .cc-monitor .value {
        font-size: 4.5rem;
        font-weight: bold;
        line-height: 1;
    }
    .cc-monitor .label { font-size: 0.7rem; letter-spacing: 2px; opacity: 0.8; }

    .visualizer-container {
        position: relative; width: 400px; height: 400px;
        display: flex; align-items: center; justify-content: center;
    }

    .target-grid {
        position: absolute; inset: 0;
        background-image: linear-gradient(rgba(0, 255, 204, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 204, 0.1) 1px, transparent 1px);
        background-size: 20px 20px; border: 1px solid rgba(0, 255, 204, 0.2);
    }

    .breathing-circle {
        width: 100px; height: 100px;
        border: 2px solid #00ffcc;
        transform: rotate(45deg) scale(1);
        transition: all var(--duration) linear;
    }

    .breathing-circle.IN { transform: rotate(225deg) scale(2.5); background: rgba(0, 255, 204, 0.2); }
    .breathing-circle.HOLD { transform: rotate(225deg) scale(2.5); background: rgba(0, 255, 204, 0.4); box-shadow: 0 0 30px #00ffcc; }
    .breathing-circle.OUT { transform: rotate(45deg) scale(1); background: transparent; }

    .instruction {
        position: absolute; bottom: -60px;
        font-size: 2rem; letter-spacing: 5px;
        text-shadow: 0 0 10px #00ffcc;
    }

    .finished-state {
        text-align: center; z-index: 20; padding: 20px;
        border: 1px solid #00ffcc; background: rgba(0,0,0,0.9);
    }
    .options-row { display: flex; gap: 15px; justify-content: center; margin-top: 10px; }

    .rescan-btn {
        background: transparent; color: #00ffcc; border: 1px solid #00ffcc;
        padding: 10px; cursor: pointer; font-family: inherit;
    }
    .rescan-btn:hover { background: #00ffcc; color: #000; }

    .cc-monitor .value.danger { color: #ff3333; text-shadow: 0 0 15px #ff3333; }

    .crt-overlay {
        position: absolute; inset: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.2) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.05), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.05));
        background-size: 100% 2px, 3px 100%;
        pointer-events: none; z-index: 10;
    }
</style>