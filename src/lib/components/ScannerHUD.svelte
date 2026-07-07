<script lang="ts">
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';
    import { appMode, crimeCoefficient, currentUser, terminalAutoTrigger, autoStartScan } from '$lib/stores';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { locale, dictionary } from '$lib/i18n';

    let videoElement: HTMLVideoElement;
    let scanning = false;
    let liveCCDisplay = '--';
    let liveEmotion = 'WAITING FOR DIAGNOSTIC...';
    let livePulse = '--';
    let liveDilation = 'NORMAL';
    let reportCollapsed = false;
    let dataCollapsed = false;

    function getDiagVal(type: 'HEART' | 'PUPIL' | 'BREATH' | 'EMOTION' | 'BRAIN', cc: number): string {
        const dict = $dictionary[$locale];
        if (!dict) return '';
        
        let level = 'OPTIMAL';
        if (cc > 300) {
            level = 'CRITICAL';
        } else if (cc > 100) {
            level = 'WARNING';
        }

        const key = `DIAG_${type}_${level}` as keyof typeof dict;
        return dict[key] || '';
    }

    function getDiagReason(cc: number): string {
        const dict = $dictionary[$locale];
        if (!dict) return '';

        let key = 'DIAG_OPTIMAL';
        if (cc > 300) {
            key = 'DIAG_CRITICAL';
        } else if (cc > 100) {
            key = 'DIAG_WARNING';
        }

        return dict[key as keyof typeof dict] || '';
    }

    onMount(async () => {
        if (typeof window !== 'undefined') {
            const isMobile = window.innerWidth <= 768;
            reportCollapsed = isMobile;
            dataCollapsed = isMobile;
        }

        if ($appMode === 'RESULTS') {
            liveCCDisplay = $crimeCoefficient.toString();
            liveEmotion = getDiagVal('EMOTION', $crimeCoefficient);
            livePulse = getDiagVal('HEART', $crimeCoefficient);
            liveDilation = getDiagVal('PUPIL', $crimeCoefficient);
        }

        if ($autoStartScan) {
            autoStartScan.set(false);
            promptCameraScan();
        }
    });

    let showPrivacyModal = false;

    function promptCameraScan() {
        showPrivacyModal = true;
    }

    async function acceptPrivacy() {
        showPrivacyModal = false;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoElement) videoElement.srcObject = stream;
        } catch (e) {
            console.error("Camera access denied or not found", e);
        }
        runMockScan();
    }

    function refusePrivacy() {
        showPrivacyModal = false;
    }

    async function runMockScan() {
        scanning = true;
        appMode.set('SCANNING');

        const scrambleInterval = setInterval(() => {
            liveCCDisplay = Math.floor(Math.random() * 400 + 40).toString();
            livePulse = Math.floor(Math.random() * 40 + 80).toString() + " BPM";
            
            const emotions = ['ANXIETY: 85%', 'STRESS: 79%', 'PULSE ACCELERATED', 'COGNITIVE CLOUDING', 'EMOTION: STRESSED'];
            liveEmotion = emotions[Math.floor(Math.random() * emotions.length)];
            liveDilation = Math.random() > 0.5 ? 'DILATED' : 'STRETCHED';
        }, 80);

        setTimeout(async () => {
            clearInterval(scrambleInterval);
            
            const result = Math.floor(Math.random() * 461) + 40;
            crimeCoefficient.set(result);
            liveCCDisplay = result.toString();
            scanning = false;
            appMode.set('RESULTS');
            
            if (typeof window !== 'undefined' && (window as any).umami) {
                (window as any).umami.track('biometric-scan', { cc: result });
            }
            
            livePulse = getDiagVal('HEART', result);
            liveDilation = getDiagVal('PUPIL', result);
            liveEmotion = getDiagVal('EMOTION', result);

            try {
                await fetch('/api/save-biometric', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cc: result, userId: $currentUser })
                });
            } catch (err) {
                console.error("Database sync failed:", err);
            }
        }, 3000);
    }

    function triggerManualTextScan() {
        terminalAutoTrigger.set('EVALUATE');
        appMode.set('TERMINAL');
    }

    function handleInterventionChoice(targetMode: 'TERMINAL' | 'BREATHING') {
        appMode.set(targetMode);
        const hasBypassParam = $page.url.searchParams.get('bypass') === 'true';
        if (hasBypassParam) {
            goto('/');
        }
    }

    function handleKeyDown(event: KeyboardEvent) {
        const key = event.key.toUpperCase();

        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
            return;
        }

        if (key === 'D') {
            event.preventDefault();
            dataCollapsed = !dataCollapsed;
        }

        if ($appMode === 'INITIAL') {
            if (key === 'C' && !showPrivacyModal) {
                event.preventDefault();
                promptCameraScan();
            }
            if (key === 'M' && !showPrivacyModal) {
                event.preventDefault();
                triggerManualTextScan();
            }
        }
        else if ($appMode === 'RESULTS') {
            if (key === 'B' && $crimeCoefficient > 100) {
                event.preventDefault();
                handleInterventionChoice('BREATHING');
            }
            if (key === 'T') {
                event.preventDefault();
                handleInterventionChoice('TERMINAL');
            }
            if (key === 'H') {
                event.preventDefault();
                reportCollapsed = !reportCollapsed;
            }
        }
    }
</script>

<svelte:window on:keydown={handleKeyDown} />

<div class="hud-container" transition:fade>
    <video bind:this={videoElement} autoplay playsinline muted></video>

    <div class="overlay">
        <div class="scan-grid"></div>

        <div class="crosshairs" class:scanning>
            {#if scanning}
                <div class="locking-notif">{$dictionary[$locale].HUD_LOCKING}</div>
            {/if}
        </div>

        {#if $appMode === 'RESULTS'}
            <div class="report-box" class:collapsed={reportCollapsed} class:border-lethal={$crimeCoefficient > 300} class:border-warning={$crimeCoefficient > 100 && $crimeCoefficient <= 300} transition:fade>
                <div class="panel-header-row">
                    <span class="diag-title">// SIBYL DIAGNOSTIC REPORT //</span>
                    <button class="collapse-toggle-btn" on:click={() => reportCollapsed = !reportCollapsed}>
                        {reportCollapsed ? '[H] EXPAND' : '[H] RETRACT'}
                    </button>
                </div>
                {#if !reportCollapsed}
                    <div class="diagnostic-breakdown" transition:fade>
                        <div class="diag-row">
                            <span class="diag-label">{$dictionary[$locale].DIAG_LABEL_HEART}:</span>
                            <span class="diag-val">{getDiagVal('HEART', $crimeCoefficient)}</span>
                        </div>
                        <div class="diag-row">
                            <span class="diag-label">{$dictionary[$locale].DIAG_LABEL_PUPIL}:</span>
                            <span class="diag-val">{getDiagVal('PUPIL', $crimeCoefficient)}</span>
                        </div>
                        <div class="diag-row">
                            <span class="diag-label">{$dictionary[$locale].DIAG_LABEL_BREATH}:</span>
                            <span class="diag-val">{getDiagVal('BREATH', $crimeCoefficient)}</span>
                        </div>
                        <div class="diag-row">
                            <span class="diag-label">{$dictionary[$locale].DIAG_LABEL_EMOTION}:</span>
                            <span class="diag-val">{getDiagVal('EMOTION', $crimeCoefficient)}</span>
                        </div>
                        <div class="diag-row">
                            <span class="diag-label">{$dictionary[$locale].DIAG_LABEL_BRAIN}:</span>
                            <span class="diag-val">{getDiagVal('BRAIN', $crimeCoefficient)}</span>
                        </div>
                        <hr class="card-divider" />
                        <p class="diagnostic-reason" class:lethal={$crimeCoefficient > 300} class:warning={$crimeCoefficient > 100 && $crimeCoefficient <= 300}>
                            {getDiagReason($crimeCoefficient)}
                        </p>
                    </div>
                {/if}
            </div>
        {/if}

        <div class="data-box" class:collapsed={dataCollapsed} class:border-lethal={$crimeCoefficient > 300 && $appMode === 'RESULTS'} class:border-warning={$crimeCoefficient > 100 && $crimeCoefficient <= 300 && $appMode === 'RESULTS'}>
            <div class="panel-header-row">
                <h3>{$dictionary[$locale].HUD_TITLE}</h3>
                <button class="collapse-toggle-btn" on:click={() => dataCollapsed = !dataCollapsed}>
                    {dataCollapsed ? '[D] EXPAND' : '[D] RETRACT'}
                </button>
            </div>
            {#if !dataCollapsed}
                <div class="data-box-content" transition:fade>
                    <p>{$dictionary[$locale].HUD_USER}: {$currentUser ? $currentUser.toUpperCase() : $dictionary[$locale].HUD_GUEST}</p>

                    {#if $appMode === 'INITIAL' || $appMode === 'SCANNING'}
                        <p>{$dictionary[$locale].HUD_TARGET}: {scanning ? $dictionary[$locale].HUD_TARGET_LOCKING : $dictionary[$locale].HUD_TARGET_WAITING}</p>
                        <hr class="card-divider" />
                        <p class="cc-display">CC: {liveCCDisplay}</p>
                        {#if scanning}
                            <p class="telemetry">{$dictionary[$locale].HUD_PULSE}: {livePulse}</p>
                            <p class="telemetry">{$dictionary[$locale].HUD_PUPIL}: {liveDilation}</p>
                            <p class="telemetry warning">{liveEmotion}</p>
                        {/if}
                    {:else}
                        <p>{$dictionary[$locale].HUD_TARGET_ACQUIRED}</p>
                        <hr class="card-divider" />
                        <p class="cc-display">CC: {liveCCDisplay}</p>
                        <p class="status" class:lethal={$crimeCoefficient > 300} class:warning={$crimeCoefficient > 100 && $crimeCoefficient <= 300} class:optimal={$crimeCoefficient <= 100}>
                            {$dictionary[$locale].HUD_STATUS}: {$crimeCoefficient > 300 ? $dictionary[$locale].HUD_STATUS_LETHAL : ($crimeCoefficient > 100 ? $dictionary[$locale].HUD_STATUS_PARALYZER : $dictionary[$locale].HUD_STATUS_MONITOR)}
                        </p>
                    {/if}
                </div>
            {/if}
        </div>

        <div class="action-buttons">
            {#if showPrivacyModal}
                <div class="intervention-box" transition:fade>
                    <h3 class="warning-text">{$dictionary[$locale].CAMERA_PRIVACY_TEXT}</h3>
                    <div class="options-row">
                        <button class="warning-border" on:click={acceptPrivacy}>{$dictionary[$locale].CAMERA_PRIVACY_ACCEPT}</button>
                        <button on:click={refusePrivacy}>{$dictionary[$locale].CAMERA_PRIVACY_REFUSE}</button>
                    </div>
                </div>
            {:else if $appMode === 'INITIAL'}
                <div class="intervention-box" transition:fade>
                    <h3 class="warning-text">{$dictionary[$locale].HUD_INTAKE_NODE}</h3>
                    <div class="options-row">
                        <button on:click={promptCameraScan}>{$dictionary[$locale].HUD_BTN_CAMERA}</button>
                        <button on:click={triggerManualTextScan}>{$dictionary[$locale].HUD_BTN_TEXT}</button>
                    </div>
                </div>

            {:else}
                <div class="running-status" class:hidden={$appMode !== 'SCANNING'}>
                    {$dictionary[$locale].HUD_ANALYZING}
                </div>

                {#if $appMode === 'RESULTS'}
                    <div class="intervention-box" class:border-lethal={$crimeCoefficient > 300} class:border-warning={$crimeCoefficient > 100 && $crimeCoefficient <= 300} transition:fade>
                        <h3 class="warning-text">{$dictionary[$locale].HUD_INTERVENTION_TITLE}</h3>
                        <div class="options-row">
                            {#if $crimeCoefficient > 100}
                                <button on:click={() => handleInterventionChoice('BREATHING')}>{$dictionary[$locale].HUD_BTN_BREATHING}</button>
                            {/if}
                            <button on:click={() => handleInterventionChoice('TERMINAL')}>{$dictionary[$locale].HUD_BTN_TERMINAL}</button>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>

<style>
    .hud-container { position: relative; height: 100%; width: 100%; background: radial-gradient(circle, #001a1a 0%, #000 100%); overflow: hidden; font-family: monospace; box-sizing: border-box; }
    video { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .scan-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px); background-size: 50px 50px; z-index: 1; }
    .overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 5; }

    .data-box { position: absolute; top: 40px; right: 40px; background: rgba(0, 0, 0, 0.92); padding: 25px; border-left: 4px solid #0ff; color: #0ff; box-shadow: 0 0 20px rgba(0, 255, 255, 0.15); z-index: 20; transition: all 0.5s ease; }
    .data-box.border-warning { border-left: 4px solid #ffaa00; box-shadow: 0 0 20px rgba(255, 170, 0, 0.15); color: #ffaa00; }
    .data-box.border-lethal { border-left: 4px solid #ff0044; box-shadow: 0 0 20px rgba(255, 0, 68, 0.15); color: #ff0044; }
    
    .data-box.border-warning .card-divider { border-top-color: rgba(255, 170, 0, 0.2); }
    .data-box.border-lethal .card-divider { border-top-color: rgba(255, 0, 68, 0.2); }
    
    .report-box { position: absolute; top: 40px; left: 40px; background: rgba(0, 0, 0, 0.92); padding: 25px; border-right: 4px solid #0ff; color: #0ff; box-shadow: 0 0 20px rgba(0, 255, 255, 0.15); z-index: 20; transition: all 0.5s ease; }
    .report-box.border-warning { border-right: 4px solid #ffaa00; box-shadow: 0 0 20px rgba(255, 170, 0, 0.15); color: #ffaa00; }
    .report-box.border-lethal { border-right: 4px solid #ff0044; box-shadow: 0 0 20px rgba(255, 0, 68, 0.15); color: #ff0044; }
    
    .report-box.border-warning .card-divider { border-top-color: rgba(255, 170, 0, 0.2); }
    .report-box.border-lethal .card-divider { border-top-color: rgba(255, 0, 68, 0.2); }
    
    .report-box.border-warning .diag-label { color: rgba(255, 170, 0, 0.75); }
    .report-box.border-lethal .diag-label { color: rgba(255, 0, 68, 0.75); }

    .card-divider { border: 0; border-top: 1px solid rgba(0, 255, 255, 0.2); margin: 10px 0; }
    .cc-display { font-size: 1.5rem; margin: 10px 0; font-weight: bold; }
    
    .status { font-weight: bold; }
    .status.optimal { color: #00ffcc; text-shadow: 0 0 10px #00ffcc; }
    .status.warning { color: #ffaa00; text-shadow: 0 0 10px #ffaa00; }
    .status.lethal { color: #ff0044; text-shadow: 0 0 10px #ff0044; }
    .lethal { color: #ff0044; text-shadow: 0 0 10px #ff0044; }

    .telemetry { font-size: 0.8rem; margin: 4px 0; color: #00ffcc; opacity: 0.8; }
    .telemetry.warning { color: #ff3333; font-weight: bold; animation: blink 0.5s infinite; }

    button { z-index: 30; padding: 15px 30px; background: rgba(0, 255, 255, 0.02); border: 1px solid #0ff; color: #0ff; cursor: pointer; letter-spacing: 2px; transition: all 0.2s ease; font-family: inherit; font-size: 0.9rem; }
    button:hover { background: rgba(0, 255, 255, 0.15); box-shadow: 0 0 15px #0ff; color: #fff; }

    .crosshairs { width: 300px; height: 300px; border: 1px solid rgba(0, 255, 255, 0.3); border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10; }
    .locking-notif { position: absolute; bottom: -40px; color: #ff3333; font-size: 0.85rem; letter-spacing: 2px; animation: blink 0.5s infinite; }
    .scanning { border: 2px solid #ff3333; box-shadow: 0 0 30px rgba(255, 51, 51, 0.4); animation: scan-pulse 1.5s infinite; }

    .action-buttons { position: absolute; bottom: 60px; display: flex; flex-direction: column; align-items: center; z-index: 30; width: 100%; min-height: 160px; justify-content: center; }
    .intervention-box { background: rgba(5, 5, 5, 0.95); border: 1px solid #0ff; padding: 25px 35px; text-align: center; box-shadow: 0 0 25px rgba(0, 255, 255, 0.15); max-width: 800px; transition: all 0.5s ease; color: #0ff; }
    .intervention-box.border-warning { border-color: #ffaa00; box-shadow: 0 0 25px rgba(255, 170, 0, 0.15); color: #ffaa00; }
    .intervention-box.border-lethal { border-color: #ff0044; box-shadow: 0 0 25px rgba(255, 0, 68, 0.15); color: #ff0044; }
    
    .intervention-box.border-warning button { border-color: #ffaa00; color: #ffaa00; }
    .intervention-box.border-warning button:hover { background: rgba(255, 170, 0, 0.15); box-shadow: 0 0 15px #ffaa00; color: #fff; }
    .intervention-box.border-lethal button { border-color: #ff0044; color: #ff0044; }
    .intervention-box.border-lethal button:hover { background: rgba(255, 0, 68, 0.15); box-shadow: 0 0 15px #ff0044; color: #fff; }

    .options-row { display: flex; gap: 20px; justify-content: center; margin-bottom: 15px; }
    .warning-text { color: inherit; text-shadow: 0 0 10px currentColor; margin-top: 0; margin-bottom: 20px; text-align: center; font-size: 1rem; letter-spacing: 1px; }
    .running-status { color: #ff3333; font-weight: bold; font-size: 1.1rem; letter-spacing: 2px; animation: blink 0.8s infinite; text-shadow: 0 0 8px rgba(255, 51, 51, 0.3); }
    .hidden { display: none !important; }

    .diagnostic-breakdown {
        font-size: 0.8rem;
        letter-spacing: 1px;
        min-width: 320px;
    }
    .diag-title {
        color: #00ffcc;
        font-weight: bold;
        margin-bottom: 10px;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.4);
    }
    .report-box.border-warning .diag-title {
        color: #ffaa00;
        text-shadow: 0 0 5px rgba(255, 170, 0, 0.4);
    }
    .report-box.border-lethal .diag-title {
        color: #ff0044;
        text-shadow: 0 0 5px rgba(255, 0, 68, 0.4);
    }
    .diag-row {
        display: flex;
        justify-content: space-between;
        margin: 6px 0;
        gap: 15px;
    }
    .diag-label {
        color: rgba(0, 255, 255, 0.75);
    }
    .diag-val {
        color: #ffffff;
        text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
        text-align: right;
    }
    .diagnostic-reason {
        font-size: 0.75rem;
        line-height: 1.4;
        color: #00ffcc;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.3);
        margin: 10px 0 0 0;
    }
    .diagnostic-reason.warning {
        color: #ffaa00;
        text-shadow: 0 0 5px rgba(255, 170, 0, 0.3);
    }
    .diagnostic-reason.lethal {
        color: #ff0044;
        text-shadow: 0 0 5px rgba(255, 0, 68, 0.3);
    }

    .panel-header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        width: 100%;
        gap: 15px;
    }

    .data-box h3 {
        margin: 0;
        font-size: 1rem;
        letter-spacing: 1px;
    }

    .collapse-toggle-btn {
        background: transparent;
        border: 1px solid currentColor;
        color: inherit;
        padding: 3px 8px;
        font-size: 0.7rem;
        cursor: pointer;
        font-family: inherit;
        letter-spacing: 1px;
        transition: all 0.2s ease;
        text-shadow: none;
        white-space: nowrap;
    }

    .collapse-toggle-btn:hover {
        background: rgba(0, 255, 255, 0.15);
        box-shadow: 0 0 8px currentColor;
    }

    .report-box.collapsed, .data-box.collapsed {
        padding: 12px 20px;
    }

    @media (max-width: 768px) {
        .data-box {
            top: 15px;
            right: 15px;
            left: 15px;
            z-index: 100;
        }
        .report-box {
            top: 75px;
            left: 15px;
            right: 15px;
            z-index: 90;
        }
        .crosshairs {
            width: 180px;
            height: 180px;
        }
        .action-buttons {
            bottom: 25px;
            min-height: auto;
        }
        .intervention-box {
            padding: 15px;
            width: calc(100% - 30px);
            box-sizing: border-box;
        }
        .options-row {
            flex-direction: column;
            gap: 10px;
        }
        .options-row button {
            width: 100%;
            padding: 10px;
        }
    }

    @keyframes scan-pulse { 0% { transform: scale(1); } 50% { transform: scale(1.04); } 100% { transform: scale(1); } }
    @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
</style>