<script lang="ts">
    import { appMode } from '$lib/stores';
    import ScannerHUD from '$lib/components/ScannerHUD.svelte';
    import BreathingVisualizer from '$lib/components/BreathingVisualizer.svelte';
    import Terminal from '$lib/components/Terminal.svelte';
    import { fade } from 'svelte/transition';
</script>

{#if $appMode === 'INITIAL' || $appMode === 'SCANNING' || $appMode === 'RESULTS'}
    <div class="view-wrapper" transition:fade><ScannerHUD /></div>
{:else}
    {#if $appMode === 'BREATHING'}
        <div class="view-wrapper" transition:fade><BreathingVisualizer /></div>
    {:else}
        <div class="view-wrapper" transition:fade><Terminal /></div>
    {/if}
{/if}

<style>
    :global(body) { margin: 0; background: black; overflow: hidden; }

    .view-wrapper {
        width: 100%;
        height: 100%;
    }
</style>