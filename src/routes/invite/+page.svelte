<script lang="ts">
    import { fade } from 'svelte/transition';
    import { goto } from '$app/navigation';
    import { locale, dictionary } from '$lib/i18n';
    import { currentUser } from '$lib/stores';

    const guildLink = "https://discord.com/oauth2/authorize?client_id=1516433121724338186&permissions=2952906768&integration_type=0&scope=bot+applications.commands";
    const userLink = "https://discord.com/oauth2/authorize?client_id=1516433121724338186&integration_type=0&scope=applications.commands";

    function handleReturn() {
        if ($currentUser) {
            goto('/account');
        } else {
            goto('/auth');
        }
    }
</script>

<svelte:head>
    <title>{$dictionary[$locale].INVITE_TITLE}</title>
    <meta name="description" content="Integrate the Sibyl System diagnostic bot into your Discord workspace or profile." />
</svelte:head>

<div class="invite-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="main-card card-border">
        <h1 class="header">{$dictionary[$locale].INVITE_TITLE}</h1>
        <div class="subtitle">{$dictionary[$locale].INVITE_SUBTITLE}</div>

        <div class="grid-layout">
            <div class="deploy-card card-border server-theme">
                <div class="card-glow"></div>
                <div class="card-header">
                    <span class="badge server-badge">{$dictionary[$locale].INVITE_SERVER_BADGE}</span>
                    <h2>{$dictionary[$locale].INVITE_SERVER_TITLE}</h2>
                </div>
                <p class="desc">{$dictionary[$locale].INVITE_SERVER_DESC}</p>
                <a href={guildLink} target="_blank" rel="noopener noreferrer" class="action-btn link-btn">
                    {$dictionary[$locale].INVITE_SERVER_BTN}
                </a>
            </div>

            <div class="deploy-card card-border user-theme">
                <div class="card-glow"></div>
                <div class="card-header">
                    <span class="badge user-badge">{$dictionary[$locale].INVITE_USER_BADGE}</span>
                    <h2>{$dictionary[$locale].INVITE_USER_TITLE}</h2>
                </div>
                <p class="desc">{$dictionary[$locale].INVITE_USER_DESC}</p>
                <a href={userLink} target="_blank" rel="noopener noreferrer" class="action-btn link-btn">
                    {$dictionary[$locale].INVITE_USER_BTN}
                </a>
            </div>
        </div>

        <div class="warning-section card-border">
            <span class="warn-label">{$dictionary[$locale].INVITE_WARN_LABEL}</span>
            <p class="warn-text">{$dictionary[$locale].INVITE_WARNING}</p>
        </div>

        <button class="return-btn" on:click={handleReturn}>
            {$dictionary[$locale].INVITE_RETURN_BTN}
        </button>
    </div>
</div>

<style>
    .invite-container {
        position: absolute;
        inset: 0;
        background: #050505;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Courier New', Courier, monospace;
        color: #00ffcc;
        padding: 20px;
        box-sizing: border-box;
        overflow: hidden;
    }

    .main-card {
        background: #050505;
        padding: 30px;
        width: 100%;
        max-width: 900px;
        height: 100%;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        overflow-y: auto;
        position: relative;
    }

    .card-border {
        border: 1px solid #00ffcc;
        box-shadow: 0 0 20px rgba(0, 255, 204, 0.1);
    }

    .header {
        font-size: 1.1rem;
        border-bottom: 1px solid rgba(0, 255, 204, 0.3);
        padding-bottom: 15px;
        margin: 0 0 5px 0;
        letter-spacing: 2px;
        font-weight: bold;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.5);
    }

    .subtitle {
        font-size: 0.75rem;
        color: #888;
        letter-spacing: 1px;
        margin-bottom: 25px;
        text-transform: uppercase;
    }

    .grid-layout {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 25px;
        margin-bottom: 25px;
        flex-grow: 1;
    }

    .deploy-card {
        background: rgba(0, 255, 204, 0.01);
        padding: 25px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
        transition: all 0.3s ease-in-out;
    }

    .card-glow {
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 50% 50%, rgba(0, 255, 204, 0.05) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
    }

    .deploy-card:hover .card-glow {
        opacity: 1;
    }

    /* Server Card Specifics */
    .server-theme {
        border-color: rgba(0, 255, 204, 0.4);
    }
    .server-theme:hover {
        border-color: #00ffcc;
        box-shadow: 0 0 25px rgba(0, 255, 204, 0.2);
        background: rgba(0, 255, 204, 0.03);
    }

    /* User Card Specifics */
    .user-theme {
        border-color: rgba(255, 170, 0, 0.4);
    }
    .user-theme h2 {
        color: #ffaa00;
        text-shadow: 0 0 5px rgba(255, 170, 0, 0.3);
    }
    .user-theme:hover {
        border-color: #ffaa00;
        box-shadow: 0 0 25px rgba(255, 170, 0, 0.2);
        background: rgba(255, 170, 0, 0.03);
    }
    .user-theme .action-btn {
        border-color: #ffaa00;
        color: #ffaa00;
    }
    .user-theme .action-btn:hover {
        background: #ffaa00;
        color: #050505;
        box-shadow: 0 0 15px #ffaa00;
    }

    .card-header h2 {
        font-size: 1.15rem;
        margin: 10px 0 0 0;
        letter-spacing: 1px;
    }

    .badge {
        font-size: 0.65rem;
        font-weight: bold;
        padding: 3px 8px;
        border: 1px solid;
        display: inline-block;
        letter-spacing: 1px;
    }

    .server-badge {
        border-color: #00ffcc;
        color: #00ffcc;
        background: rgba(0, 255, 204, 0.1);
    }

    .user-badge {
        border-color: #ffaa00;
        color: #ffaa00;
        background: rgba(255, 170, 0, 0.1);
    }

    .desc {
        font-size: 0.8rem;
        line-height: 1.6;
        color: #ccc;
        margin: 20px 0;
        flex-grow: 1;
    }

    .action-btn {
        display: block;
        text-align: center;
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85rem;
        letter-spacing: 1.5px;
        transition: all 0.2s;
        text-decoration: none;
        font-weight: bold;
    }

    .action-btn:hover {
        background: #00ffcc;
        color: #050505;
        box-shadow: 0 0 15px #00ffcc;
    }

    .warning-section {
        background: rgba(255, 51, 51, 0.02);
        border: 1px solid rgba(255, 51, 51, 0.3);
        padding: 15px;
        margin-bottom: 25px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .warn-label {
        font-size: 0.75rem;
        color: #ff3333;
        font-weight: bold;
        letter-spacing: 2px;
        text-shadow: 0 0 5px rgba(255, 51, 51, 0.4);
    }

    .warn-text {
        font-size: 0.75rem;
        color: #ff9999;
        margin: 0;
        line-height: 1.4;
    }

    .return-btn {
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        padding: 12px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9rem;
        letter-spacing: 2px;
        transition: all 0.2s;
        text-align: center;
    }

    .return-btn:hover {
        background: #00ffcc;
        color: #050505;
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
        .grid-layout {
            grid-template-columns: 1fr;
            gap: 10px;
            margin-bottom: 15px;
        }
        .main-card {
            padding: 15px;
            max-height: 95%;
        }
        .deploy-card {
            padding: 12px;
        }
        .desc {
            margin: 5px 0;
            font-size: 0.7rem;
        }
        .subtitle {
            margin-bottom: 12px;
        }
        .warning-section {
            padding: 10px;
            margin-bottom: 15px;
        }
    }
</style>
