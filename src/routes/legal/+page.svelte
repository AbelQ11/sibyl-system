<script lang="ts">
    import { locale, dictionary } from '$lib/i18n';
    import { fade } from 'svelte/transition';
</script>

<svelte:head>
    <title>SIBYL SYSTEM - {$dictionary[$locale].NAV_LEGAL || '[ LEGAL ]'}</title>
</svelte:head>

<div class="legal-container" transition:fade>
    <div class="legal-header">
        <h1 class="glitch-text" data-text="SYSTEM_DIRECTIVES">SYSTEM_DIRECTIVES</h1>
    </div>

    <div class="legal-menu">
        <a href="/privacy" class="legal-btn">
            <div class="legal-info">
                <h3>{$dictionary[$locale].NAV_PRIVACY || 'PRIVACY POLICY'}</h3>
                <p>{$dictionary[$locale].SEO_PRIVACY_DESC || 'Official declaration regarding biometric scans and privacy.'}</p>
            </div>
        </a>

        <a href="/terms" class="legal-btn">
            <div class="legal-info">
                <h3>{$dictionary[$locale].NAV_TERMS || 'TERMS OF SERVICE'}</h3>
                <p>{$dictionary[$locale].SEO_TERMS_DESC || 'Terms detailing diagnostic consent and system enforcements.'}</p>
            </div>
        </a>
    </div>

    <div class="return-nav">
        <a href="/" class="return-btn">[ RETURN TO HUB ]</a>
    </div>
</div>

<style>
    .legal-container {
        width: 100%;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px 20px;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        color: var(--main-color, #00ffcc);
        height: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }

    .legal-header {
        margin-bottom: 40px;
        text-align: center;
        border-bottom: 1px dashed var(--main-color, #00ffcc);
        padding-bottom: 20px;
    }

    .glitch-text {
        font-size: 2rem;
        margin: 0;
        text-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.6));
    }

    .legal-menu {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .legal-btn {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 25px;
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid var(--border-color, rgba(0, 255, 204, 0.3));
        text-decoration: none;
        color: inherit;
        transition: all 0.3s ease;
    }

    .legal-btn:hover {
        background: rgba(0, 255, 204, 0.1);
        border-color: var(--main-color, #00ffcc);
        box-shadow: 0 0 15px var(--main-glow, rgba(0, 255, 204, 0.4));
    }

    .legal-info h3 {
        margin: 0 0 10px 0;
        font-size: 1.3rem;
        letter-spacing: 2px;
        text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5));
    }

    .legal-info p {
        margin: 0;
        font-size: 0.95rem;
        line-height: 1.4;
        opacity: 0.8;
    }

    .return-nav {
        margin-top: 40px;
        text-align: center;
    }

    .return-btn {
        display: inline-block;
        padding: 10px 20px;
        background: transparent;
        color: var(--main-color, #00ffcc);
        border: 1px solid var(--main-color, #00ffcc);
        text-decoration: none;
        font-weight: bold;
        transition: all 0.2s;
    }

    .return-btn:hover {
        background: var(--main-color, #00ffcc);
        color: #000;
        box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.8));
    }

    @media (max-width: 600px) {
        .legal-btn {
            flex-direction: column;
            text-align: center;
            padding: 20px;
        }
    }
</style>
