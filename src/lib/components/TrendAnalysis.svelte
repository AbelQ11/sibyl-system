<script lang="ts">
    import { onMount } from 'svelte';
    import { appMode, currentUser } from '$lib/stores';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';

    let firstCC = 0;
    let lastCC = 0;
    let loading = true;

    const mapY = (cc: number) => 300 - (cc / 500) * 250;

    onMount(async () => {
        // FIXED: Check against the raw string value instead of an object property
        if ($currentUser) {
            try {
                // FIXED: Pass the raw string value directly to your backend lookup path
                const res = await fetch(`/api/stats?userId=${$currentUser}`);
                if (res.ok) {
                    const data = await res.json();
                    firstCC = data.first_cc || 0;
                    lastCC = data.last_cc || 0;
                }
            } catch (err) {
                console.error("Failed to retrieve psych trend data");
            }
        }
        loading = false;
    });
</script>

<div class="trend-overlay" transition:fade>
    <div class="trend-card">
        <div class="header">{$dictionary[$locale].TREND_SUBJECT}: {$currentUser ? $currentUser : 'GUEST'} | {$dictionary[$locale].TREND_TITLE}</div>

        {#if loading}
            <div class="message-state">{$dictionary[$locale].TREND_RETRIEVING}</div>
        {:else if firstCC === 0 && lastCC === 0}
            <div class="message-state">{$dictionary[$locale].TREND_NO_DATA}</div>
        {:else}
            <svg viewBox="0 0 400 300" class="graph">
                {#each [100, 200, 300, 400, 500] as mark}
                    <line x1="0" y1={mapY(mark)} x2="400" y2={mapY(mark)} stroke="rgba(0, 255, 204, 0.15)" />
                {/each}

                <line x1="50" y1={mapY(firstCC)} x2="350" y2={mapY(lastCC)}
                      stroke="#00ffcc" stroke-width="2" stroke-dasharray="5" />

                <circle cx="50" cy={mapY(firstCC)} r="6" fill="#00ffcc" />
                <text x="20" y={mapY(firstCC) - 15} fill="#00ffcc" font-size="12">{$dictionary[$locale].TREND_ENTRY}: {firstCC}</text>

                <circle cx="350" cy={mapY(lastCC)} r="6" fill={lastCC > 100 ? '#ff3333' : '#00ffcc'} />
                <text x="310" y={mapY(lastCC) - 15} fill="#00ffcc" font-size="12">{$dictionary[$locale].TREND_CURRENT}: {lastCC}</text>
            </svg>

            <div class="status" class:bad={lastCC > firstCC}>
                {$dictionary[$locale].TREND_RESULT}: {lastCC > firstCC ? $dictionary[$locale].TREND_DETERIORATING : $dictionary[$locale].TREND_STABILIZING}
            </div>
        {/if}

        <button class="back-btn" on:click={() => appMode.set('TERMINAL')}>
            {$dictionary[$locale].TREND_RETURN}
        </button>
    </div>
</div>

<style>
    .trend-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        font-family: 'Courier New', Courier, monospace;
    }

    .trend-card {
        border: 1px solid #00ffcc;
        background: #050505;
        padding: 30px;
        width: 90%;
        max-width: 600px;
        color: #00ffcc;
        box-shadow: 0 0 20px rgba(0, 255, 204, 0.1);
    }

    .header {
        font-size: 0.9rem;
        margin-bottom: 30px;
        border-bottom: 1px solid rgba(0, 255, 204, 0.3);
        padding-bottom: 10px;
        letter-spacing: 2px;
    }

    .message-state {
        text-align: center;
        padding: 50px 0;
        font-size: 1.1rem;
        letter-spacing: 1px;
    }

    .graph {
        width: 100%;
        border-bottom: 1px solid #00ffcc;
        border-left: 1px solid #00ffcc;
        margin-bottom: 10px;
        /* Subtle grid pattern in the background */
        background: linear-gradient(rgba(0, 255, 204, 0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 255, 204, 0.05) 1px, transparent 1px);
        background-size: 20px 20px;
    }

    .status {
        margin-bottom: 20px;
        font-weight: bold;
        text-align: center;
        font-size: 1.1rem;
        letter-spacing: 2px;
    }

    .status.bad {
        color: #ff3333;
        text-shadow: 0 0 10px #ff3333;
    }

    .back-btn {
        width: 100%;
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 1rem;
        letter-spacing: 2px;
        transition: all 0.2s ease;
    }

    .back-btn:hover {
        background: #00ffcc;
        color: #000;
        box-shadow: 0 0 15px #00ffcc;
    }
</style>