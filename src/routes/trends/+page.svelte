<script lang="ts">
    import { onMount } from 'svelte';
    import { currentUser } from '$lib/stores';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';

    let loading = true;
    let history: { cc: number, type?: string, created_at: string }[] = [];
    let dailyHistory: { date: string, firstCC: number, secondCC: number | null }[] = [];

    const mapY = (cc: number) => 380 - (cc / 500) * 300;
    const mapX = (index: number, total: number) => {
        if (total <= 1) return 300;
        return 80 + (index / (total - 1)) * 440;
    };

    onMount(async () => {
        if (!$currentUser) {
            goto('/auth');
            return;
        }

        try {
            const res = await fetch(`/api/stats?userId=${$currentUser}`);
            if (res.ok) {
                const data = await res.json();
                history = data.history || [];
                processHistory(history);
            }
        } catch (err) {
            console.error("Failed to retrieve psych trend history logs");
        } finally {
            loading = false;
        }
    });

    function processHistory(rawHistory: { cc: number, created_at: string }[]) {
        const groups: { [key: string]: number[] } = {};
        for (const item of rawHistory) {
            const dateStr = item.created_at ? item.created_at.substring(0, 10) : '';
            if (dateStr) {
                if (!groups[dateStr]) {
                    groups[dateStr] = [];
                }
                groups[dateStr].push(item.cc);
            }
        }

        const processed = [];
        for (const date in groups) {
            const scans = groups[date];
            processed.push({
                date: formatDate(date),
                firstCC: scans[0],
                secondCC: scans.length > 1 ? scans[1] : null
            });
        }
        dailyHistory = processed;
    }

    function formatDate(dateStr: string) {
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[1]}/${parts[2]}`;
            }
        } catch (e) {}
        return dateStr;
    }

    function formatFullDate(dateStr: string) {
        try {
            return dateStr.replace('T', ' ').replace(/\.\d+Z/, '').substring(0, 19);
        } catch (e) {}
        return dateStr;
    }

    function getThreatStatus(cc: number) {
        if (cc > 300) return $dictionary[$locale].TRENDS_STATUS_LETHAL;
        if (cc > 100) return $dictionary[$locale].TRENDS_STATUS_PARALYZER;
        return $dictionary[$locale].TRENDS_STATUS_MONITOR;
    }
</script>

<svelte:head>
    <title>{$dictionary[$locale].SEO_TRENDS_TITLE}</title>
    <meta name="description" content={$dictionary[$locale].SEO_TRENDS_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_TRENDS_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_TRENDS_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://sibyl-system.mooo.com/trends" />
    <meta property="og:image" content="https://sibyl-system.mooo.com/favicon.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_TRENDS_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_TRENDS_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.mooo.com/favicon.png" />
</svelte:head>

<div class="trends-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="main-card card-border">
        <h1 class="header">{$dictionary[$locale].TRENDS_PAGE_TITLE}</h1>

        <div class="subject-info">
            <span>{$dictionary[$locale].TRENDS_SUBJECT_ID}: {$currentUser ? $currentUser.toUpperCase() : 'UNKNOWN'}</span>
            <span>{$dictionary[$locale].TRENDS_SYSTEM_STATUS}: {$dictionary[$locale].TRENDS_STATUS_CONNECTED}</span>
        </div>

        {#if loading}
            <div class="message-state">{$dictionary[$locale].TRENDS_RETRIEVING_LOGS}</div>
        {:else if dailyHistory.length === 0}
            <div class="message-state">{$dictionary[$locale].TRENDS_NO_LOGS}</div>
        {:else}
            <div class="chart-panel card-border">
                <h2 class="panel-header">{$dictionary[$locale].TRENDS_HISTOGRAM_TITLE}</h2>
                <div class="svg-container">
                    <svg viewBox="0 0 600 440" class="graph">
                        <rect x="0" y={mapY(100)} width="600" height={mapY(0) - mapY(100)} fill="rgba(0, 255, 204, 0.02)" />

                        <rect x="0" y={mapY(300)} width="600" height={mapY(100) - mapY(300)} fill="rgba(255, 150, 0, 0.02)" />
                        <rect x="0" y={mapY(500)} width="600" height={mapY(300) - mapY(500)} fill="rgba(255, 51, 51, 0.02)" />

                        <line x1="0" y1={mapY(100)} x2="600" y2={mapY(100)} stroke="rgba(0, 255, 204, 0.3)" stroke-width="1.5" stroke-dasharray="3 3" />
                        <text x="15" y={mapY(100) - 6} fill="#00ffcc" font-size="10" font-family="monospace">{$dictionary[$locale].TRENDS_THRESHOLD_MONITOR}</text>

                        <line x1="0" y1={mapY(300)} x2="600" y2={mapY(300)} stroke="rgba(255, 51, 51, 0.3)" stroke-width="1.5" stroke-dasharray="3 3" />
                        <text x="15" y={mapY(300) - 6} fill="#ff3333" font-size="10" font-family="monospace">{$dictionary[$locale].TRENDS_THRESHOLD_LETHAL}</text>

                        {#each dailyHistory as day, index}
                            {@const x = mapX(index, dailyHistory.length)}
                            {@const y1 = mapY(day.firstCC)}
                            
                            {#if day.secondCC !== null}
                                {@const y2 = mapY(day.secondCC)}
                                <line x1={x} y1={y1} x2={x} y2={y2} 
                                      stroke={day.secondCC > 100 ? '#ff3333' : '#00ffcc'} 
                                      stroke-width="3" />
                                
                                <circle cx={x} cy={y2} r="6" fill={day.secondCC > 100 ? '#ff3333' : '#00ffcc'} class="dot" />
                                <text x={x + 10} y={y2 + 3} fill={day.secondCC > 100 ? '#ff3333' : '#00ffcc'} font-size="10" font-family="monospace">2nd: {day.secondCC}</text>
                            {/if}

                            <circle cx={x} cy={y1} r="6" fill={day.firstCC > 100 ? '#ff3333' : '#00ffcc'} class="dot" />
                            <text x={x - 48} y={y1 + 3} fill="#00ffcc" font-size="10" font-family="monospace">1st: {day.firstCC}</text>

                            <text x={x} y="415" fill="#00ffcc" font-size="10" text-anchor="middle" font-family="monospace">{day.date}</text>
                        {/each}
                    </svg>
                </div>
            </div>

             <div class="table-panel card-border">
                <h2 class="panel-header">{$dictionary[$locale].TRENDS_TELEMETRY_LOGS}</h2>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>{$dictionary[$locale].TRENDS_COL_SCAN_ID}</th>
                                <th>{$dictionary[$locale].TRENDS_COL_SCAN_TYPE || 'METHOD'}</th>
                                <th>{$dictionary[$locale].TRENDS_COL_TIMESTAMP}</th>
                                <th>{$dictionary[$locale].TRENDS_COL_CC}</th>
                                <th>{$dictionary[$locale].TRENDS_COL_THREAT}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each history as item, index}
                                <tr class:lethal={item.cc > 300} class:warning={item.cc > 100 && item.cc <= 300}>
                                    <td>#{history.length - index}</td>
                                    <td>
                                        <span class="scan-type-tag type-{item.type || 'terminal'}">
                                            {item.type === 'biometric' ? ($dictionary[$locale].SCAN_TYPE_BIOMETRIC || 'BIOMETRIC') : ($dictionary[$locale].SCAN_TYPE_TERMINAL || 'TERMINAL')}
                                        </span>
                                    </td>
                                    <td>{formatFullDate(item.created_at)}</td>
                                    <td class="cc-cell">{item.cc}</td>
                                    <td>{getThreatStatus(item.cc)}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}

        <div class="actions-row">
            <button class="nav-btn" on:click={() => goto('/account')}>{$dictionary[$locale].TRENDS_BTN_ACCOUNT}</button>
            <button class="nav-btn terminal-btn" on:click={() => goto('/')}>{$dictionary[$locale].TRENDS_BTN_TERMINAL}</button>
        </div>
    </div>
</div>

<style>
    .trends-container {
        position: fixed;
        inset: 0;
        background: #050505;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Courier New', Courier, monospace;
        color: #00ffcc;
        padding: 30px;
        box-sizing: border-box;
        overflow: hidden;
    }

    .main-card {
        background: #050505;
        padding: 30px;
        width: 100%;
        max-width: 1000px;
        height: 100%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow-y: auto;
    }

    .card-border {
        border: 1px solid #00ffcc;
        box-shadow: 0 0 20px rgba(0, 255, 204, 0.1);
    }

    .header {
        font-size: 1.1rem;
        border-bottom: 1px solid rgba(0, 255, 204, 0.3);
        padding-bottom: 15px;
        margin: 0 0 15px 0;
        letter-spacing: 2px;
        font-weight: bold;
    }

    .subject-info {
        display: flex;
        justify-content: space-between;
        font-size: 0.85rem;
        margin-bottom: 25px;
        color: rgba(0, 255, 204, 0.75);
    }

    .message-state {
        text-align: center;
        padding: 100px 0;
        border: 1px dashed rgba(0, 255, 204, 0.2);
        margin-bottom: 20px;
    }

    .chart-panel {
        background: #050505;
        margin-bottom: 25px;
        display: flex;
        flex-direction: column;
    }

    .panel-header {
        font-size: 0.85rem;
        background: rgba(0, 255, 204, 0.05);
        padding: 8px 15px;
        border-bottom: 1px solid rgba(0, 255, 204, 0.2);
        font-weight: bold;
        letter-spacing: 1px;
        margin: 0;
    }

    .svg-container {
        padding: 20px;
    }

    .graph {
        width: 100%;
        border-bottom: 1px solid #00ffcc;
        border-left: 1px solid #00ffcc;
        background: linear-gradient(rgba(0, 255, 204, 0.02) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 255, 204, 0.02) 1px, transparent 1px);
        background-size: 30px 30px;
    }

    .dot {
        transition: r 0.2s ease;
    }
    .dot:hover {
        r: 8px;
    }

    .table-panel {
        background: #050505;
        margin-bottom: 25px;
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        overflow: hidden;
        min-height: 200px;
    }

    .table-container {
        overflow-y: auto;
        overflow-x: auto;
        flex-grow: 1;
        padding: 10px;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.85rem;
    }

    th {
        border-bottom: 1px solid rgba(0, 255, 204, 0.4);
        padding: 10px;
        font-weight: bold;
        color: #00ffcc;
    }

    td {
        padding: 10px;
        border-bottom: 1px solid rgba(0, 255, 204, 0.1);
        color: rgba(255, 255, 255, 0.85);
    }

    tr:hover td {
        background: rgba(0, 255, 204, 0.04);
        color: #fff;
    }

    .cc-cell {
        font-weight: bold;
        color: #00ffcc;
    }

    tr.warning td {
        color: #ffaa00;
    }
    tr.warning .cc-cell {
        color: #ffaa00;
    }

    tr.lethal td {
        color: #ff3333;
    }
    tr.lethal .cc-cell {
        color: #ff3333;
    }

    .scan-type-tag {
        display: inline-block;
        padding: 2px 6px;
        font-size: 0.7rem;
        font-weight: bold;
        letter-spacing: 1px;
        border: 1px solid currentColor;
        text-shadow: none;
    }
    .type-biometric {
        color: #00ffcc;
        background: rgba(0, 255, 204, 0.08);
        box-shadow: 0 0 5px rgba(0, 255, 204, 0.15);
    }
    .type-terminal {
        color: #00bfff;
        background: rgba(0, 191, 255, 0.08);
        box-shadow: 0 0 5px rgba(0, 191, 255, 0.15);
    }

    .actions-row {
        display: flex;
        gap: 20px;
        margin-top: 10px;
    }

    .nav-btn {
        flex: 1;
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        letter-spacing: 1px;
        transition: all 0.2s;
    }

    .nav-btn:hover {
        background: #00ffcc;
        color: #000;
        box-shadow: 0 0 15px #00ffcc;
    }

    .terminal-btn {
        border-color: #00ffcc;
    }

    .crt-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%);
        background-size: 100% 2px;
        pointer-events: none;
        z-index: 10;
    }

    @media (max-width: 768px) {
        .trends-container {
            padding: 10px 10px 65px 10px;
        }
        .main-card {
            padding: 15px;
            max-height: 100%;
            height: 100%;
        }
        .subject-info {
            flex-direction: column;
            gap: 5px;
        }
        .panel-header {
            font-size: 0.75rem;
            padding: 8px 10px;
        }
        table {
            font-size: 0.75rem;
        }
        th, td {
            padding: 6px;
        }
        .actions-row {
            flex-direction: column;
            gap: 10px;
        }
    }
</style>
