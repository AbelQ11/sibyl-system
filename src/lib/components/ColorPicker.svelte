<script lang="ts">
    export let color = 'var(--main-color, #00ffcc)';
    export let label = 'Color';
    
    let hex = color;
    let r = parseInt(color.slice(1, 3), 16) || 0;
    let g = parseInt(color.slice(3, 5), 16) || 255;
    let b = parseInt(color.slice(5, 7), 16) || 204;
    let showPicker = false;

    $: if (color && color !== hex && !showPicker) {
        hex = color;
        if (hex.length === 7) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
    }

    function updateFromRgb() {
        const toHex = (n: number) => {
            const h = Math.max(0, Math.min(255, n)).toString(16);
            return h.length === 1 ? '0' + h : h;
        };
        hex = '#' + toHex(r) + toHex(g) + toHex(b);
        color = hex;
    }

    function togglePicker() {
        showPicker = !showPicker;
    }

    function clickOutside(node: HTMLElement) {
        const handleClick = (event: MouseEvent) => {
            if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
                showPicker = false;
            }
        };
        document.addEventListener('click', handleClick, true);
        return {
            destroy() {
                document.removeEventListener('click', handleClick, true);
            }
        };
    }
</script>

<div class="custom-color-picker" use:clickOutside>
    <label>{label}</label>
    <div class="picker-trigger" on:click={togglePicker}>
        <div class="swatch" style="background-color: {color};"></div>
        <span class="hex-val">{color}</span>
    </div>

    {#if showPicker}
        <div class="picker-panel">
            <div class="slider-group">
                <label>R</label>
                <input type="range" min="0" max="255" bind:value={r} on:input={updateFromRgb} style="accent-color: #ff3333;" />
                <span>{r}</span>
            </div>
            <div class="slider-group">
                <label>G</label>
                <input type="range" min="0" max="255" bind:value={g} on:input={updateFromRgb} style="accent-color: #33ff33;" />
                <span>{g}</span>
            </div>
            <div class="slider-group">
                <label>B</label>
                <input type="range" min="0" max="255" bind:value={b} on:input={updateFromRgb} style="accent-color: #3333ff;" />
                <span>{b}</span>
            </div>
            <div class="hex-input-group">
                <label style="color:var(--main-color, #00ffcc);">HEX</label>
                <input type="text" bind:value={hex} on:change={() => {
                    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
                        color = hex;
                        r = parseInt(hex.slice(1, 3), 16);
                        g = parseInt(hex.slice(3, 5), 16);
                        b = parseInt(hex.slice(5, 7), 16);
                    }
                }} />
            </div>
        </div>
    {/if}
</div>

<style>
    .custom-color-picker {
        display: flex;
        flex-direction: column;
        gap: 5px;
        position: relative;
    }
    label {
        font-size: 0.7rem;
        color: #888;
    }
    .picker-trigger {
        display: flex;
        align-items: center;
        gap: 10px;
        background: transparent;
        border: 1px solid var(--main-color, #00ffcc);
        padding: 5px;
        cursor: pointer;
        width: 120px;
    }
    .swatch {
        width: 25px;
        height: 25px;
        border: 1px solid rgba(255,255,255,0.3);
    }
    .hex-val {
        color: #fff;
        font-size: 0.8rem;
        font-family: monospace;
    }
    .picker-panel {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 5px;
        background: var(--bg-color, #050505);
        border: 1px solid var(--main-color, #00ffcc);
        padding: 15px;
        z-index: 100;
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 200px;
        box-shadow: 0 0 15px var(--border-color, rgba(0, 255, 204, 0.2));
    }
    .slider-group {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.8rem;
        color: #fff;
    }
    .slider-group input[type="range"] {
        flex: 1;
        cursor: pointer;
    }
    .slider-group span {
        width: 25px;
        text-align: right;
    }
    .hex-input-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 5px;
    }
    .hex-input-group input {
        width: 100%;
        background: transparent;
        border: 1px solid var(--main-color, #00ffcc);
        color: #fff;
        padding: 5px;
        font-family: monospace;
    }
</style>
