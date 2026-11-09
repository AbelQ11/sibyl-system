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
    <link rel="canonical" href="https://sibyl-system.kiliotsu.eu/" />
    <meta name="description" content={$dictionary[$locale].SEO_HOME_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_HOME_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_HOME_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Sibyl System" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:url" content="https://sibyl-system.kiliotsu.eu/" />
    <meta property="og:image" content="https://sibyl-system.kiliotsu.eu/og-image.jpg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_HOME_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_HOME_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.kiliotsu.eu/og-image.jpg" />
    <meta name="twitter:image:alt" content="Sibyl System — biometric terminal" />
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