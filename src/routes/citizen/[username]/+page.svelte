<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { locale, dictionary } from '$lib/i18n';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';

    const username = $page.params.username;
    
    let loading = true;
    let unauthorized = false;
    let avatar: string | null = null;
    let citizenId = '';
    let firstCC = 0;
    let lastCC = 0;
    
    interface ScanData {
        cc: number;
        type?: string;
        created_at: string;
    }
    
    interface DailyData {
        date: string;
        firstCC: number;
        secondCC: number | null;
    }

    let history: ScanData[] = [];
    let dailyHistory: DailyData[] = [];

    const mapY = (cc: number) => 380 - (cc / 500) * 300;
    const mapX = (index: number, total: number) => {
        if (total <= 1) return 300;
        return 80 + (index / (total - 1)) * 440;
    };

    onMount(async () => {
        try {
            const res = await fetch(`/api/stats?userId=${username}`);
            if (res.ok) {
                const data = await res.json();
                firstCC = data.first_cc || 0;
                lastCC = data.last_cc || 0;
                avatar = data.avatar || null;
                citizenId = data.citizen_id || 'SIB-UNKNOWN';
                history = data.history || [];
                processHistory(history);
            } else if (res.status === 403) {
                unauthorized = true;
            }
        } catch (err) {
            console.error('Failed to retrieve citizen logs:', err);
        } finally {
            loading = false;
        }
    });

    function processHistory(rawHistory: ScanData[]) {
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

        const processed: DailyData[] = [];
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
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            return date.toLocaleString();
        } catch (e) {
            return dateStr;
        }
    }

    function getThreatStatus(cc: number) {
        if (cc >= 300) return $dictionary[$locale].TRENDS_STATUS_LETHAL;
        if (cc > 100) return $dictionary[$locale].TRENDS_STATUS_PARALYZER;
        return $dictionary[$locale].TRENDS_STATUS_MONITOR;
    }
</script>

<svelte:head>
    <title>
        {unauthorized 
            ? $dictionary[$locale].CITIZEN_RESTRICTED_TITLE 
            : `${$dictionary[$locale].CITIZEN_PROFILE_TITLE} // ${username.toUpperCase()}`}
    </title>
    <meta name="description" content="Inspect citizen psychological profiles." />
    <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="profile-container" transition:fade>
    <div class="crt-overlay"></div>

    {#if loading}
        <div class="loading-panel card-border">
            <div class="loader-text">CONNECTING TO SIBYL SYSTEM MAIN CORE...</div>
        </div>
    {:else if unauthorized}
        <div class="restricted-card card-border">
            <h1 class="header">{$dictionary[$locale].CITIZEN_RESTRICTED_TITLE}</h1>
            <div class="security-level">{$dictionary[$locale].CITIZEN_RESTRICTED_STATUS}</div>
            <p class="restricted-desc">{$dictionary[$locale].CITIZEN_RESTRICTED_DESC}</p>
            <button class="return-btn" on:click={() => goto('/friends')}>
                {$dictionary[$locale].CITIZEN_RETURN_BTN}
            </button>
        </div>
    {:else}
        <div class="main-card card-border">
            <h1 class="header">{$dictionary[$locale].CITIZEN_PROFILE_TITLE} // {username.toUpperCase()}</h1>
            <div class="security-level">{$dictionary[$locale].CITIZEN_PROFILE_STATUS}</div>

            <div class="subject-info">
                <span>{$dictionary[$locale].TRENDS_SUBJECT_ID}: {username.toUpperCase()} ({citizenId || 'SIB-UNKNOWN'})</span>
                <span>{$dictionary[$locale].TRENDS_SYSTEM_STATUS}: {$dictionary[$locale].TRENDS_STATUS_CONNECTED}</span>
            </div>

            <div class="dashboard-grid">
                <div class="panel card-border">
                    <h2 class="sub-header">// CITIZEN LOGISTICS</h2>
                    <div class="avatar-section">
                        <div class="avatar-frame">
                            {#if avatar}
                                <img src={avatar} alt={username} />
                            {:else}
                                <div class="blank-avatar"></div>
                            {/if}
                        </div>
                        <div class="bio-meta">
                            <span class="bio-label">CITIZEN COGNITIVE SIGNATURE</span>
                            <span class="bio-value">{username.toUpperCase()}</span>
                            <span class="bio-label">SYSTEM ID ADDRESS</span>
                            <span class="bio-value">{citizenId || 'SIB-UNKNOWN'}</span>
                        </div>
                    </div>

                    <div class="cc-readout">
                        <span class="readout-label">LATEST CRIME COEFFICIENT READOUT:</span>
                        <div class="cc-number" class:stable={lastCC < 100} class:warning={lastCC >= 100 && lastCC < 300} class:lethal={lastCC >= 300}>
                            {lastCC}
                        </div>
                        <span class="readout-status" class:text-stable={lastCC < 100} class:text-warning={lastCC >= 100 && lastCC < 300} class:text-lethal={lastCC >= 300}>
                            {getThreatStatus(lastCC)}
                        </span>
                    </div>
                </div>

                <div class="panel card-border">
                    <h2 class="sub-header">{$dictionary[$locale].TRENDS_HISTOGRAM_TITLE}</h2>
                    {#if dailyHistory.length === 0}
                        <div class="empty-state">{$dictionary[$locale].TRENDS_NO_LOGS}</div>
                    {:else}
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
                    {/if}
                </div>
            </div>

            {#if dailyHistory.length > 0}
                <div class="table-panel card-border">
                    <h2 class="sub-header">{$dictionary[$locale].TRENDS_TELEMETRY_LOGS}</h2>
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

            <button class="return-btn" on:click={() => goto('/friends')}>
                {$dictionary[$locale].CITIZEN_RETURN_BTN}
            </button>
        </div>
    {/if}
</div>

<style>
    .profile-container { position: absolute; inset: 0; background: #050505; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: #00ffcc; padding: 20px; overflow: hidden; }
    .loading-panel { padding: 40px; background: #050505; border: 1px solid #00ffcc; text-align: center; }
    .loader-text { font-size: 0.95rem; font-weight: bold; letter-spacing: 2px; }
    
    .restricted-card { background: #050505; padding: 40px; width: 100%; max-width: 500px; display: flex; flex-direction: column; text-align: center; }
    .restricted-desc { font-size: 0.9rem; line-height: 1.6; margin-bottom: 30px; color: rgba(255, 255, 255, 0.85); }
    
    .main-card { background: #050505; padding: 30px; width: 100%; max-width: 1100px; height: 100%; max-height: 85vh; display: flex; flex-direction: column; box-sizing: border-box; overflow-y: auto; }
    .card-border { border: 1px solid #00ffcc; box-shadow: 0 0 20px rgba(0, 255, 204, 0.1); }
    .header { font-size: 1.1rem; border-bottom: 1px solid rgba(0, 255, 204, 0.3); padding-bottom: 15px; margin: 0 0 15px 0; letter-spacing: 2px; font-weight: bold; }
    .security-level { font-size: 0.75rem; color: #ff3333; letter-spacing: 1px; margin-bottom: 15px; text-shadow: 0 0 5px rgba(255, 51, 84, 0.3); }
    .security-level.text-stable { color: #00ffcc; text-shadow: 0 0 5px rgba(0, 255, 204, 0.3); }

    .subject-info { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 25px; color: rgba(0, 255, 204, 0.75); }

    .dashboard-grid { display: grid; grid-template-columns: 1fr 1.5fr; gap: 25px; margin-bottom: 25px; }
    .panel { background: #050505; padding: 20px; display: flex; flex-direction: column; }
    .sub-header { font-size: 0.85rem; letter-spacing: 1px; font-weight: bold; margin: 0 0 20px 0; color: #00ffcc; border-bottom: 1px dashed rgba(0, 255, 204, 0.15); padding-bottom: 5px; }

    .avatar-section { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; }
    .avatar-frame { width: 90px; height: 90px; border: 1px solid #00ffcc; background: #111; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .avatar-frame img { width: 100%; height: 100%; object-fit: cover; }
    .blank-avatar { width: 100%; height: 100%; background: #00ffcc; opacity: 0.25; }

    .bio-meta { display: flex; flex-direction: column; gap: 4px; }
    .bio-label { font-size: 0.7rem; color: rgba(0, 255, 204, 0.7); letter-spacing: 1px; }
    .bio-value { font-size: 0.9rem; font-weight: bold; color: #fff; margin-bottom: 8px; }

    .cc-readout { border: 1px solid rgba(0, 255, 204, 0.3); padding: 15px; text-align: center; background: rgba(0, 255, 204, 0.02); }
    .readout-label { font-size: 0.75rem; letter-spacing: 1px; color: rgba(0, 255, 204, 0.8); }
    .cc-number { font-size: 3rem; font-weight: bold; margin: 10px 0; font-family: 'Courier New', monospace; text-shadow: 0 0 10px rgba(0, 255, 204, 0.5); }
    .cc-number.stable { color: #00ffcc; text-shadow: 0 0 10px #00ffcc; }
    .cc-number.warning { color: #ffaa00; text-shadow: 0 0 10px #ffaa00; }
    .cc-number.lethal { color: #ff3333; text-shadow: 0 0 15px #ff3333; animation: blink-text 1s infinite alternate; }
    .readout-status { font-size: 1rem; font-weight: bold; letter-spacing: 2px; }

    .empty-state { font-size: 0.8rem; opacity: 0.6; padding: 40px 0; text-align: center; }
    .svg-container { padding: 10px 0; }
    .graph { width: 100%; border-bottom: 1px solid #00ffcc; border-left: 1px solid #00ffcc; background: linear-gradient(rgba(0, 255, 204, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 204, 0.02) 1px, transparent 1px); background-size: 30px 30px; }
    .dot { cursor: pointer; }
    
    .table-panel { background: #050505; padding: 20px; display: flex; flex-direction: column; margin-bottom: 25px; }
    .table-container { width: 100%; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { font-size: 0.8rem; color: #00ffcc; border-bottom: 1px solid rgba(0, 255, 204, 0.3); padding: 10px; font-weight: bold; letter-spacing: 1px; }
    td { padding: 10px; font-size: 0.8rem; border-bottom: 1px solid rgba(0, 255, 204, 0.1); color: #fff; }
    
    tr.warning td { color: #ffaa00; }
    tr.lethal td { color: #ff3333; }
    
    .cc-cell { font-family: monospace; font-weight: bold; }
    .scan-type-tag { font-size: 0.7rem; padding: 2px 6px; border: 1px solid; font-family: monospace; }
    .scan-type-tag.type-biometric { border-color: #00ffcc; color: #00ffcc; }
    .scan-type-tag.type-terminal { border-color: #ffaa00; color: #ffaa00; }

    .return-btn { background: transparent; border: 1px solid #00ffcc; color: #00ffcc; padding: 12px; cursor: pointer; font-family: inherit; font-size: 0.95rem; letter-spacing: 2px; transition: all 0.2s; margin-top: auto; }
    .return-btn:hover { background: #00ffcc; color: #000; box-shadow: 0 0 15px #00ffcc; }
    
    .text-stable { color: #00ffcc; }
    .text-warning { color: #ffaa00; }
    .text-lethal { color: #ff3333; }

    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 2px; pointer-events: none; z-index: 10; }

    @keyframes blink-text {
        from { text-shadow: 0 0 15px #ff3333; }
        to { text-shadow: 0 0 3px #ff3333; }
    }

    @media (max-width: 900px) {
        .dashboard-grid { grid-template-columns: 1fr; }
        .profile-container { padding: 15px 15px 65px 15px; align-items: flex-start; }
        .main-card { padding: 15px; height: 100%; max-height: 100%; }
        .avatar-section { flex-direction: column; align-items: flex-start; }
    }
</style>
