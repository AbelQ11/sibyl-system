<script lang="ts">
    import { fade } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { locale, dictionary } from '$lib/i18n';
</script>

<svelte:head>
    <title>{$dictionary[$locale].SEO_PRIVACY_TITLE}</title>
    <meta name="description" content={$dictionary[$locale].SEO_PRIVACY_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_PRIVACY_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_PRIVACY_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://sibyl-system.mooo.com/privacy" />
    <meta property="og:image" content="https://sibyl-system.mooo.com/favicon.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_PRIVACY_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_PRIVACY_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.mooo.com/favicon.png" />
</svelte:head>

<div class="privacy-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="main-card card-border">
        <h1 class="header">{$dictionary[$locale].PRIVACY_TITLE}</h1>

        <div class="security-level">{$dictionary[$locale].PRIVACY_STATUS}</div>

        <div class="content-body">
            <h3>{$dictionary[$locale].PRIVACY_SEC1_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC1_DESC}
            </p>
            <ul>
                <li>{$dictionary[$locale].PRIVACY_SEC1_ITEM1}</li>
                <li>{$dictionary[$locale].PRIVACY_SEC1_ITEM2}</li>
                <li>{$dictionary[$locale].PRIVACY_SEC1_ITEM3}</li>
                <li>{$dictionary[$locale].PRIVACY_SEC1_ITEM4}</li>
            </ul>

            <h3>{$dictionary[$locale].PRIVACY_SEC2_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC2_DESC}
            </p>

            <h3>{$dictionary[$locale].PRIVACY_SEC3_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC3_DESC}
            </p>

            <h3>{$dictionary[$locale].PRIVACY_SEC4_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC4_DESC}
            </p>

            <h3>{$dictionary[$locale].PRIVACY_SEC5_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC5_DESC}
            </p>

            <h3>{$dictionary[$locale].PRIVACY_SEC6_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC6_DESC}
            </p>

            <h3>{$dictionary[$locale].PRIVACY_SEC7_TITLE}</h3>
            <p>
                {$dictionary[$locale].PRIVACY_SEC7_DESC}
            </p>
        </div>

        <button class="return-btn" on:click={() => goto('/')}>
            {$dictionary[$locale].PRIVACY_RETURN_BTN}
        </button>
    </div>
</div>

<style>
    .privacy-container {
        position: absolute;
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
        max-width: 800px;
        height: 100%;
        max-height: 80vh;
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
        margin-bottom: 15px;
        letter-spacing: 2px;
        font-weight: bold;
    }

    .security-level {
        font-size: 0.75rem;
        color: #ff3333;
        letter-spacing: 1px;
        margin-bottom: 25px;
        text-shadow: 0 0 5px rgba(255, 51, 84, 0.3);
    }

    .content-body {
        font-size: 0.9rem;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.85);
        margin-bottom: 30px;
        flex-grow: 1;
    }

    h3 {
        color: #00ffcc;
        font-size: 1rem;
        margin-top: 25px;
        letter-spacing: 1px;
    }

    ul {
        padding-left: 20px;
    }

    li {
        margin: 8px 0;
    }

    .return-btn {
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.95rem;
        letter-spacing: 2px;
        transition: all 0.2s;
        margin-top: auto;
    }

    .return-btn:hover {
        background: #00ffcc;
        color: #000;
        box-shadow: 0 0 15px #00ffcc;
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
        .privacy-container {
            padding: 10px 10px 65px 10px;
        }
        .main-card {
            padding: 15px;
            max-height: 100%;
            height: 100%;
        }
        .content-body {
            font-size: 0.8rem;
            line-height: 1.4;
        }
        h3 {
            font-size: 0.9rem;
            margin-top: 15px;
        }
    }
</style>
