<script lang="ts">
    import { locale, dictionary } from '$lib/i18n';

    export let history: { cc: number, created_at: string }[] = [];
    export let width = 600;
    export let height = 440;

    let timeScale: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' = 'DAY';
    let offset = 0;
    let points: { label: string, cc: number }[] = [];
    let periodLabel = '';

    const mapY = (cc: number) => (height - 60) - (cc / 500) * (height - 140);
    const mapX = (index: number, total: number) => {
        if (total <= 1) return width / 2;
        return 80 + (index / (total - 1)) * (width - 160);
    };

    function changeScale(scale: 'DAY' | 'WEEK' | 'MONTH' | 'YEAR') {
        timeScale = scale;
        offset = 0;
    }

    $: {
        const now = new Date();
        const baseDate = new Date(now);

        if (timeScale === 'DAY') {
            baseDate.setDate(now.getDate() + offset);
        } else if (timeScale === 'WEEK') {
            baseDate.setDate(now.getDate() + (offset * 7));
        } else if (timeScale === 'MONTH') {
            baseDate.setMonth(now.getMonth() + offset);
        } else if (timeScale === 'YEAR') {
            baseDate.setFullYear(now.getFullYear() + offset);
        }

        let filtered = [];

        if (timeScale === 'DAY') {
            periodLabel = baseDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            filtered = history.filter(item => {
                const d = new Date(item.created_at);
                return d >= start && d < end;
            });
        } else if (timeScale === 'WEEK') {
            const day = baseDate.getDay() || 7;
            const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - day + 1);
            periodLabel = `WEEK OF ${start.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).toUpperCase()}`;
            const end = new Date(start);
            end.setDate(end.getDate() + 7);
            filtered = history.filter(item => {
                const d = new Date(item.created_at);
                return d >= start && d < end;
            });
        } else if (timeScale === 'MONTH') {
            periodLabel = baseDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }).toUpperCase();
            const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
            const end = new Date(start);
            end.setMonth(end.getMonth() + 1);
            filtered = history.filter(item => {
                const d = new Date(item.created_at);
                return d >= start && d < end;
            });
        } else if (timeScale === 'YEAR') {
            periodLabel = baseDate.getFullYear().toString();
            const start = new Date(baseDate.getFullYear(), 0, 1);
            const end = new Date(start);
            end.setFullYear(end.getFullYear() + 1);
            filtered = history.filter(item => {
                const d = new Date(item.created_at);
                return d >= start && d < end;
            });
        }

        const groups: { [key: string]: number[] } = {};

        if (timeScale === 'DAY') {
            filtered.forEach(item => {
                const d = new Date(item.created_at);
                const label = `${d.getHours().toString().padStart(2, '0')}:00`;
                if (!groups[label]) groups[label] = [];
                groups[label].push(item.cc);
            });
        } else if (timeScale === 'WEEK') {
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            filtered.forEach(item => {
                const d = new Date(item.created_at);
                const label = days[d.getDay()];
                if (!groups[label]) groups[label] = [];
                groups[label].push(item.cc);
            });
        } else if (timeScale === 'MONTH') {
            filtered.forEach(item => {
                const d = new Date(item.created_at);
                const week = Math.ceil(d.getDate() / 7);
                const label = `W${week}`;
                if (!groups[label]) groups[label] = [];
                groups[label].push(item.cc);
            });
        } else if (timeScale === 'YEAR') {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            filtered.forEach(item => {
                const d = new Date(item.created_at);
                const label = months[d.getMonth()];
                if (!groups[label]) groups[label] = [];
                groups[label].push(item.cc);
            });
        }

        const processed = [];
        for (const [label, ccs] of Object.entries(groups)) {
            const avg = Math.round(ccs.reduce((a, b) => a + b, 0) / ccs.length);
            processed.push({ label, cc: avg });
        }

        if (timeScale === 'DAY') {
            processed.sort((a, b) => a.label.localeCompare(b.label));
        } else if (timeScale === 'WEEK') {
            const order: Record<string, number> = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };
            processed.sort((a, b) => order[a.label] - order[b.label]);
        } else if (timeScale === 'MONTH') {
            processed.sort((a, b) => a.label.localeCompare(b.label));
        } else if (timeScale === 'YEAR') {
            const order: Record<string, number> = { 'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6, 'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12 };
            processed.sort((a, b) => order[a.label] - order[b.label]);
        }

        points = processed;
    }
</script>

<div class="time-graph-container">
    <div class="header-row">
        <div class="period-nav">
            <button class="nav-btn" on:click={() => offset -= 1}>&lt;</button>
            <span class="period-label">{periodLabel}</span>
            <button class="nav-btn" on:click={() => offset += 1} disabled={offset === 0}>&gt;</button>
        </div>
        <div class="controls">
            <button class:active={timeScale === 'DAY'} on:click={() => changeScale('DAY')}>{$dictionary[$locale].SCALE_DAY || 'DAY'}</button>
            <button class:active={timeScale === 'WEEK'} on:click={() => changeScale('WEEK')}>{$dictionary[$locale].SCALE_WEEK || 'WEEK'}</button>
            <button class:active={timeScale === 'MONTH'} on:click={() => changeScale('MONTH')}>{$dictionary[$locale].SCALE_MONTH || 'MONTH'}</button>
            <button class:active={timeScale === 'YEAR'} on:click={() => changeScale('YEAR')}>{$dictionary[$locale].SCALE_YEAR || 'YEAR'}</button>
        </div>
    </div>

    <div class="svg-container">
        <svg viewBox="0 0 {width} {height}" class="graph">
            <rect x="0" y={mapY(100)} width={width} height={mapY(0) - mapY(100)} fill="rgba(0, 255, 204, 0.02)" />
            <rect x="0" y={mapY(300)} width={width} height={mapY(100) - mapY(300)} fill="rgba(255, 150, 0, 0.02)" />
            <rect x="0" y={mapY(500)} width={width} height={mapY(300) - mapY(500)} fill="rgba(255, 51, 51, 0.02)" />

            <line x1="0" y1={mapY(100)} x2={width} y2={mapY(100)} stroke="rgba(0, 255, 204, 0.3)" stroke-width="1.5" stroke-dasharray="3 3" />
            <text x="15" y={mapY(100) - 6} fill="#00ffcc" font-size="10" font-family="monospace">{$dictionary[$locale].TRENDS_THRESHOLD_MONITOR || 'OPTIMAL (100)'}</text>

            <line x1="0" y1={mapY(300)} x2={width} y2={mapY(300)} stroke="rgba(255, 51, 51, 0.3)" stroke-width="1.5" stroke-dasharray="3 3" />
            <text x="15" y={mapY(300) - 6} fill="#ff3333" font-size="10" font-family="monospace">{$dictionary[$locale].TRENDS_THRESHOLD_LETHAL || 'LETHAL (300)'}</text>

            {#if points.length === 0}
                <text x={width/2} y={height/2} fill="rgba(0, 255, 204, 0.5)" font-size="14" text-anchor="middle" font-family="monospace">
                    {$dictionary[$locale].TREND_NO_DATA || 'NO DATA AVAILABLE FOR THIS PERIOD'}
                </text>
            {/if}

            {#each points as point, index}
                {@const x = mapX(index, points.length)}
                {@const y = mapY(point.cc)}
                
                {#if index > 0}
                    {@const prevX = mapX(index - 1, points.length)}
                    {@const prevY = mapY(points[index - 1].cc)}
                    <line x1={prevX} y1={prevY} x2={x} y2={y} stroke="rgba(0, 255, 204, 0.4)" stroke-width="2" />
                {/if}

                <line x1={x} y1={mapY(0)} x2={x} y2={y} stroke="rgba(0, 255, 204, 0.1)" stroke-width="1" stroke-dasharray="2 2" />
                
                <circle cx={x} cy={y} r="5" fill={point.cc > 300 ? '#ff3333' : (point.cc > 100 ? '#ff9900' : '#00ffcc')} class="dot" />
                <text x={x + 10} y={y - 10} fill={point.cc > 300 ? '#ff3333' : (point.cc > 100 ? '#ff9900' : '#00ffcc')} font-size="11" font-family="monospace">{point.cc}</text>
                <text x={x} y={height - 25} fill="#00ffcc" font-size="10" text-anchor="middle" font-family="monospace">{point.label}</text>
            {/each}
        </svg>
    </div>
</div>

<style>
    .time-graph-container {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        width: 100%;
    }

    .header-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .period-nav {
        display: flex;
        align-items: center;
        gap: 1rem;
        color: #00ffcc;
        font-family: monospace;
        font-size: 0.9rem;
    }

    .nav-btn {
        background: rgba(0, 255, 204, 0.05);
        border: 1px solid rgba(0, 255, 204, 0.3);
        color: #00ffcc;
        padding: 0.2rem 0.6rem;
        cursor: pointer;
        font-family: monospace;
    }

    .nav-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .nav-btn:not(:disabled):hover {
        background: rgba(0, 255, 204, 0.2);
    }

    .period-label {
        min-width: 120px;
        text-align: center;
        letter-spacing: 1px;
    }

    .controls {
        display: flex;
        gap: 0.5rem;
    }

    .controls button {
        background: rgba(0, 255, 204, 0.05);
        border: 1px solid rgba(0, 255, 204, 0.2);
        color: rgba(0, 255, 204, 0.7);
        padding: 0.4rem 1rem;
        font-family: monospace;
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    .controls button:hover {
        background: rgba(0, 255, 204, 0.15);
        border-color: rgba(0, 255, 204, 0.5);
    }

    .controls button.active {
        background: rgba(0, 255, 204, 0.2);
        border-color: #00ffcc;
        color: #00ffcc;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.5);
    }

    .svg-container {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .graph {
        width: 100%;
        height: auto;
    }

    .dot {
        transition: all 0.3s ease;
    }
    .dot:hover {
        r: 8;
    }
</style>
