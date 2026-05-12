<script lang="ts">
    import { appMode } from '$lib/stores';
    import ScannerHUD from '$lib/components/ScannerHUD.svelte';
    import BreathingVisualizer from '$lib/components/BreathingVisualizer.svelte';
    import Terminal from '$lib/components/Terminal.svelte';
    import TrendAnalysis from '$lib/components/TrendAnalysis.svelte';
    import { fade } from 'svelte/transition';
</script>

{#if $appMode === 'INITIAL' || $appMode === 'SCANNING'}
    <div transition:fade><ScannerHUD /></div>
{:else if $appMode === 'BREATHING'}
    <div transition:fade><BreathingVisualizer /></div>
{:else if $appMode === 'TERMINAL'}
    <div transition:fade><Terminal /></div>
{:else if $appMode === 'TREND_VIEW'}
    <div transition:fade><TrendAnalysis /></div>
{/if}

<style>
    :global(body) { margin: 0; background: black; overflow: hidden; }
</style>