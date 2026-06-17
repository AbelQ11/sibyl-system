<script lang="ts">
    import { appMode } from '$lib/stores';
    import ScannerHUD from '$lib/components/ScannerHUD.svelte';
    import BreathingVisualizer from '$lib/components/BreathingVisualizer.svelte';
    import Terminal from '$lib/components/Terminal.svelte';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';
</script>

<svelte:head>
    <title>{$dictionary[$locale].SEO_HOME_TITLE}</title>
    <meta name="description" content={$dictionary[$locale].SEO_HOME_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_HOME_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_HOME_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://sibyl-system.mooo.com/" />
    <meta property="og:image" content="https://sibyl-system.mooo.com/favicon.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_HOME_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_HOME_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.mooo.com/favicon.png" />
</svelte:head>

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