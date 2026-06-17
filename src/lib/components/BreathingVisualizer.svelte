<script lang="ts">
    import { appMode, crimeCoefficient, terminalAutoTrigger, autoStartScan } from '$lib/stores';
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';

    $: t = (key: string) => ($dictionary[$locale] as Record<string, string>)[key] || key;

    let phase: 'IN' | 'HOLD' | 'OUT' | 'FINISHED' = 'OUT';
    let timer = 0;
    let initialCC = $crimeCoefficient;
    let displayCC = initialCC;
    let isInitialized = false;

    let videoElement: HTMLVideoElement;
    let livePulse = 85;
    let liveOxygen = 96;

    $: phaseTime = 4 + (initialCC / 120);
    $: targetCycles = Math.max(3, Math.floor(initialCC / 40));
    $: respiratoryRate = Math.round(60 / (phaseTime * 3));
    let currentCycle = 0;

    onMount(() => {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                videoElement.srcObject = stream;
            } catch (e) {
                console.error("Camera access denied or not found in breathing visualizer", e);
            }
        })();

        setTimeout(() => {
            isInitialized = true;
            phase = 'IN';
        }, 100);

        const startCC = initialCC;
        const targetCC = 75;
        const totalDurationSeconds = phaseTime * 3 * targetCycles;
        const ccDropPerSecond = startCC > targetCC ? (startCC - targetCC) / totalDurationSeconds : 0;

        const interval = setInterval(() => {
            if (phase === 'FINISHED') { clearInterval(interval); return; }

            timer++;
            if (timer <= phaseTime) phase = 'IN';
            else if (timer <= phaseTime * 2) phase = 'HOLD';
            else if (timer <= phaseTime * 3) phase = 'OUT';
            else {
                timer = 0;
                currentCycle++;
                if (currentCycle >= targetCycles) {
                    phase = 'FINISHED';
                    clearInterval(interval);
                    return;
                }
            }

            // Smooth CC decrease
            const elapsedSeconds = currentCycle * phaseTime * 3 + timer;
            if (ccDropPerSecond > 0) {
                displayCC = Math.max(targetCC, Math.floor(startCC - elapsedSeconds * ccDropPerSecond));
            }

            // Telemetry updates
            const progress = elapsedSeconds / totalDurationSeconds;
            livePulse = Math.max(62, Math.floor(84 - progress * 20 + Math.random() * 2 - 1));
            liveOxygen = Math.min(99, Math.floor(96 + progress * 3));
        }, 1000);

        return () => clearInterval(interval);
    });

    function rescanText() { terminalAutoTrigger.set('EVALUATE'); appMode.set('TERMINAL'); }
    function rescanBiometric() { autoStartScan.set(true); appMode.set('INITIAL'); }
</script>

<div class="breathing-session" transition:fade>
    <video bind:this={videoElement} class={phase} autoplay playsinline muted></video>
    <div class="crt-overlay"></div>

    <div class="status-bar">
        <div class="left">{$dictionary[$locale].BREATH_PROTOCOL_CYCLE}: {currentCycle} {$dictionary[$locale].BREATH_OF} {targetCycles}</div>
        <div class="right">{$dictionary[$locale].BREATH_STABILIZATION_ACTIVE}</div>
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
                {t('BREATH_PHASE_' + phase)}
            </div>
        {:else}
            <div class="finished-state" transition:fade>
                <h2>{$dictionary[$locale].BREATH_FINISHED_TITLE}</h2>
                <p>{$dictionary[$locale].BREATH_ESTIMATED_CC}: {displayCC}</p>
                <div class="options-prompt">{$dictionary[$locale].BREATH_SELECT_METHOD}</div>
                <div class="options-row">
                    <button class="rescan-btn" on:click={rescanBiometric}>{$dictionary[$locale].BREATH_BTN_BIOMETRIC}</button>
                    <button class="rescan-btn" on:click={rescanText}>{$dictionary[$locale].BREATH_BTN_TEXT}</button>
                </div>
            </div>
        {/if}
    </div>

    {#if phase !== 'FINISHED'}
        <div class="telemetry-monitor">
            <div>{$dictionary[$locale].BREATH_TELEMETRY_TITLE}</div>
            <div>{$dictionary[$locale].BREATH_PULSE}: {livePulse} BPM</div>
            <div>{$dictionary[$locale].BREATH_OXYGEN}: {liveOxygen}%</div>
            <div>{$dictionary[$locale].BREATH_RESPIRATORY_RATE}: {respiratoryRate} BPM</div>
        </div>

        <div class="cc-monitor">
            <div class="label">{$dictionary[$locale].BREATH_LIVE_CC}</div>
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

    video { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

    .status-bar {
        position: absolute; top: 20px; width: 90%;
        display: flex; justify-content: space-between;
        border-bottom: 1px solid rgba(0, 255, 204, 0.3);
        font-size: 0.8rem;
        z-index: 15;
    }

    .telemetry-monitor {
        position: absolute;
        bottom: 40px;
        left: 40px;
        text-align: left;
        font-size: 0.95rem;
        line-height: 1.6;
        letter-spacing: 1px;
        z-index: 15;
    }

    .cc-monitor {
        position: absolute;
        bottom: 40px;
        right: 40px;
        text-align: right;
        z-index: 15;
    }

    .cc-monitor .value {
        font-size: 4.5rem;
        font-weight: bold;
        line-height: 1;
    }
    .cc-monitor .label { font-size: 0.7rem; letter-spacing: 2px; opacity: 0.8; }

    .visualizer-container {
        position: relative; width: 400px; height: 400px;
        z-index: 10;
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
        position: absolute;
        top: 150px;
        left: 150px;
    }

    .breathing-circle.IN { transform: rotate(225deg) scale(2.5); background: rgba(0, 255, 204, 0.2); }
    .breathing-circle.HOLD { transform: rotate(225deg) scale(2.5); background: rgba(0, 255, 204, 0.4); box-shadow: 0 0 30px #00ffcc; }
    .breathing-circle.OUT { transform: rotate(45deg) scale(1); background: transparent; }

    .instruction {
        position: absolute; bottom: 40px;
        width: 100%;
        text-align: center;
        font-size: 2rem; letter-spacing: 5px;
        text-shadow: 0 0 10px #00ffcc;
    }

    .finished-state {
        position: absolute;
        top: 80px;
        left: 50px;
        width: 300px;
        text-align: center; z-index: 20; padding: 20px;
        border: 1px solid #00ffcc; background: rgba(0,0,0,0.9);
        box-sizing: border-box;
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
        pointer-events: none; z-index: 100;
    }

    @media (max-width: 768px) {
        .visualizer-container {
            width: 300px;
            height: 300px;
        }
        .breathing-circle {
            top: 100px;
            left: 100px;
        }
        .telemetry-monitor {
            bottom: 15px;
            left: 15px;
            font-size: 0.8rem;
        }
        .cc-monitor {
            bottom: 15px;
            right: 15px;
        }
        .cc-monitor .value {
            font-size: 3rem;
        }
        .instruction {
            bottom: 130px;
            font-size: 1.5rem;
        }
        .finished-state {
            left: 15px;
            right: 15px;
            width: auto;
            top: 60px;
        }
        .breathing-session {
            padding-bottom: 65px;
        }
    }
</style>