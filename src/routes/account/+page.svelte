<script lang="ts">
    import { onMount } from 'svelte';
    import { currentUser, userAvatar, appMode } from '$lib/stores';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';

    import TimeGraph from '$lib/components/TimeGraph.svelte';

    export let data;
    let firstCC = 0;
    let lastCC = 0;
    let history: { cc: number, created_at: string }[] = [];
    $: averageCC = history.length > 0
        ? Math.round(history.reduce((sum, item) => sum + item.cc, 0) / history.length)
        : (lastCC || 0);
    let loading = true;
    let copied = false;
    let privacySetting = data?.user?.privacy || 'PRIVATE';

    function copySystemId() {
        if (data?.user?.citizen_id) {
            navigator.clipboard.writeText(data.user.citizen_id);
            copied = true;
            setTimeout(() => { copied = false; }, 2000);
        }
    }

    function linkDiscord() {
        window.location.href = '/api/auth/discord/link';
    }

    async function unlinkDiscord() {
        try {
            const res = await fetch('/api/auth/discord/unlink', { method: 'POST' });
            if (res.ok) {
                window.location.reload();
            }
        } catch (err) {
            console.error('Failed to unlink Discord:', err);
        }
    }

    function generateIDCard() {
        const canvas = document.getElementById('idCardCanvas') as HTMLCanvasElement;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, 600, 360);

        const grad = ctx.createLinearGradient(0, 0, 600, 360);
        grad.addColorStop(0, '#030816');
        grad.addColorStop(1, '#08142c');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 600, 360);

        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 3;
        ctx.strokeRect(12, 12, 576, 336);

        ctx.strokeStyle = 'rgba(0, 255, 204, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 20; x < 580; x += 15) {
            ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 340); ctx.stroke();
        }
        for (let y = 20; y < 340; y += 15) {
            ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(580, y); ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(430, 210, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(430, 210, 45, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(320, 210); ctx.lineTo(540, 210);
        ctx.moveTo(430, 100); ctx.lineTo(430, 320);
        ctx.stroke();

        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(25, 45); ctx.lineTo(25, 25); ctx.lineTo(45, 25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(575, 45); ctx.lineTo(575, 25); ctx.lineTo(555, 25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(25, 315); ctx.lineTo(25, 335); ctx.lineTo(45, 335); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(575, 315); ctx.lineTo(575, 335); ctx.lineTo(555, 335); ctx.stroke();

        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('SIBYL SYSTEM CORE COMPLIANCE REGISTRY', 40, 52);
        ctx.fillStyle = 'rgba(0, 255, 204, 0.6)';
        ctx.font = '9px monospace';
        ctx.fillText('VERIFIED CITIZEN SECURITY PASS // COGNITIVE SCAN LOGS', 40, 68);

        const drawDetails = () => {
            ctx.fillStyle = 'rgba(0, 255, 204, 0.7)';
            ctx.font = '10px monospace';
            ctx.fillText('SUBJECT NAME:', 180, 105);
            ctx.fillText('SYSTEM ID:', 180, 130);
            ctx.fillText('DISCORD SYNC:', 180, 155);
            ctx.fillText('COGNITIVE HUE:', 180, 180);
            ctx.fillText('CRIME COEFFICIENT:', 180, 205);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(($currentUser || 'UNKNOWN').toUpperCase(), 290, 105);
            ctx.fillText(data?.user?.citizen_id || 'SIB-PENDING', 290, 130);
            ctx.fillText(data?.user?.discord_username || 'NOT LINKED', 290, 155);

            let ccVal = averageCC;
            let hueColor = '#00ffcc';
            let hueName = 'CLEAR HUE';
            let enforcementStatus = 'PASS / OPTIMAL';
            let statusColor = '#00ffcc';

            if (ccVal > 300) {
                hueColor = '#ff3333';
                hueName = 'BLACKENED (LETHAL)';
                enforcementStatus = 'ELIMINATOR TRIGGERED';
                statusColor = '#ff3333';
            } else if (ccVal > 100) {
                hueColor = '#ffaa00';
                hueName = 'CLOUDED HUE';
                enforcementStatus = 'LATENT CRIMINAL / THERAPY REQ';
                statusColor = '#ffaa00';
            }

            ctx.fillStyle = hueColor;
            ctx.fillText(hueName, 310, 180);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ccVal.toString(), 310, 205);

            ctx.fillStyle = hueColor;
            ctx.fillRect(290, 170, 10, 10);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(290, 170, 10, 10);

            ctx.fillStyle = 'rgba(0, 255, 204, 0.05)';
            ctx.fillRect(180, 225, 380, 45);
            ctx.strokeStyle = statusColor;
            ctx.strokeRect(180, 225, 380, 45);

            ctx.fillStyle = statusColor;
            ctx.font = 'bold 11px monospace';
            ctx.fillText('ENFORCEMENT STATUS:', 195, 243);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(enforcementStatus, 195, 260);

            ctx.strokeStyle = 'rgba(0, 255, 204, 0.3)';
            ctx.strokeRect(180, 285, 380, 15);
            ctx.fillStyle = hueColor;
            const barFill = Math.min(380, (ccVal / 500) * 380);
            ctx.fillRect(180, 285, barFill, 15);

            ctx.strokeStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(180 + (100/500)*380, 285);
            ctx.lineTo(180 + (100/500)*380, 300);
            ctx.moveTo(180 + (300/500)*380, 285);
            ctx.lineTo(180 + (300/500)*380, 300);
            ctx.stroke();

            ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
            ctx.font = '7px monospace';
            ctx.fillText('SIBYL SYSTEM CORE CERTIFICATE v2.6 // CRYPTOGRAPHICALLY SECURED', 40, 340);
            ctx.fillText(`TIMESTAMP: ${new Date().toISOString()}`, 350, 340);

            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${$currentUser || 'citizen'}_sibyl_pass.png`;
            link.href = dataUrl;
            link.click();
        };

        if ($userAvatar) {
            const avatarImg = new Image();
            avatarImg.onload = () => {
                ctx.drawImage(avatarImg, 40, 90, 120, 120);
                
                ctx.strokeStyle = '#00ffcc';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(40, 90, 120, 120);

                ctx.strokeStyle = '#ff3333';
                ctx.beginPath();
                ctx.moveTo(35, 90); ctx.lineTo(45, 90);
                ctx.moveTo(155, 90); ctx.lineTo(165, 90);
                ctx.moveTo(35, 210); ctx.lineTo(45, 210);
                ctx.moveTo(155, 210); ctx.lineTo(165, 210);
                ctx.stroke();

                ctx.strokeStyle = 'rgba(0, 255, 204, 0.5)';
                ctx.beginPath();
                ctx.moveTo(35, 150); ctx.lineTo(165, 150);
                ctx.stroke();

                drawDetails();
            };
            avatarImg.src = $userAvatar;
        } else {
            ctx.strokeStyle = '#00ffcc';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(40, 90, 120, 120);

            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(100, 135, 22, 0, Math.PI * 2);
            ctx.moveTo(93, 157); ctx.lineTo(93, 175);
            ctx.moveTo(107, 157); ctx.lineTo(107, 175);
            ctx.moveTo(65, 195); ctx.lineTo(80, 175); ctx.lineTo(120, 175); ctx.lineTo(135, 195);
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 51, 51, 0.6)';
            ctx.beginPath();
            ctx.moveTo(45, 140); ctx.lineTo(155, 140);
            ctx.stroke();

            drawDetails();
        }
    }

    let newUsername = $currentUser || '';
    let newPassword = '';
    let userBio = data?.user?.bio || '';
    let settingsMessage = '';
    let settingsSuccess = false;


    onMount(async () => {
        const params = new URLSearchParams(window.location.search);
        const discordStatus = params.get('discord');
        if (discordStatus === 'success') {
            settingsSuccess = true;
            settingsMessage = "DISCORD IDENTITY SYNCHRONIZED SECURELY.";
        } else if (discordStatus === 'error') {
            settingsSuccess = false;
            settingsMessage = "ERROR: DISCORD SYNCHRONIZATION FAILED.";
        } else if (discordStatus === 'already_linked') {
            settingsSuccess = false;
            settingsMessage = $dictionary[$locale].ACC_DISCORD_ALREADY_LINKED || "ERROR: THIS DISCORD ACCOUNT IS ALREADY LINKED TO ANOTHER CITIZEN.";
        }

        if (!$currentUser) {
            goto('/auth');
            return;
        }

        try {
            const res = await fetch(`/api/stats?userId=${$currentUser}`);
            if (res.ok) {
                const statData = await res.json();
                firstCC = statData.first_cc || 0;
                lastCC = statData.last_cc || 0;
                if (statData.history) {
                    history = statData.history;
                }

                if (statData.avatar) {
                    userAvatar.set(statData.avatar);
                }
                if (statData.bio !== undefined) {
                    userBio = statData.bio || '';
                }
            }
        } catch (err) {
            console.error("Failed to retrieve psych trend data");
        } finally {
            loading = false;
        }
    });

    function handleAvatarUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files[0]) {
            const file = target.files[0];
            const reader = new FileReader();

            reader.onload = (e) => {
                if (e.target?.result) {
                    const img = new Image();
                    img.src = e.target.result as string;

                    img.onload = async () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');

                        const maxSize = 150;
                        canvas.width = maxSize;
                        canvas.height = maxSize;

                        if (ctx) {
                            ctx.drawImage(img, 0, 0, maxSize, maxSize);

                            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);

                            userAvatar.set(compressedBase64);

                            try {
                                settingsMessage = "SAVING BIO-SIGN PROFILE PHOTO...";
                                settingsSuccess = false;

                                const res = await fetch('/api/save-avatar', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        avatar: compressedBase64,
                                        userId: $currentUser
                                    })
                                });
                                const data = await res.json();

                                if (data.success) {
                                    settingsMessage = "AVATAR COMMITTED SECURELY TO CORE MEMORY.";
                                    settingsSuccess = true;
                                } else {
                                    settingsMessage = `ERROR: ${data.error || 'UPLOAD_REJECTED'}`;
                                }
                            } catch (err) {
                                console.error("Database sync failed for profile image:", err);
                                settingsMessage = "NETWORK DISRUPTION: AVATAR NOT PERSISTED.";
                            }
                        }
                    };
                }
            };
            reader.readAsDataURL(file);
        }
    }

    async function updateProfile() {
        settingsMessage = "UPDATING CORE LOGS...";
        settingsSuccess = false;

        try {
            const res = await fetch('/api/auth/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    oldUsername: $currentUser, 
                    newUsername: newUsername,
                    newPassword: newPassword,
                    privacy: privacySetting,
                    bio: userBio
                })
            });
            const data = await res.json();

            if (data.success) {
                currentUser.set(newUsername);
                settingsMessage = "PROFILE UPDATED SUCCESSFULLY.";
                settingsSuccess = true;
                newPassword = '';
            } else {
                settingsMessage = `ERROR: ${data.message || 'UPDATE_DENIED'}`;
            }
        } catch (err) {
            settingsMessage = "DATABASE RE-INDEXING FAILED.";
        }
    }

    async function handleLogout() {
        try {
            await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'LOGOUT' })
            });
        } catch (err) {
            console.error("Failed to delete session cookie on backend:", err);
        }
        currentUser.set(null);
        userAvatar.set(null);
        window.location.href = '/auth';
    }
</script>

<svelte:head>
    <title>{$dictionary[$locale].SEO_ACCOUNT_TITLE}</title>
    <meta name="description" content={$dictionary[$locale].SEO_ACCOUNT_DESC} />
    <meta property="og:title" content={$dictionary[$locale].SEO_ACCOUNT_TITLE} />
    <meta property="og:description" content={$dictionary[$locale].SEO_ACCOUNT_DESC} />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://sibyl-system.mooo.com/account" />
    <meta property="og:image" content="https://sibyl-system.mooo.com/favicon.png" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={$dictionary[$locale].SEO_ACCOUNT_TITLE} />
    <meta name="twitter:description" content={$dictionary[$locale].SEO_ACCOUNT_DESC} />
    <meta name="twitter:image" content="https://sibyl-system.mooo.com/favicon.png" />
</svelte:head>

<div class="account-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="dashboard-grid">
        <div class="panel card-border">
            <h1 class="header">{$dictionary[$locale].ACC_TITLE}</h1>

            <div class="avatar-section">
                <div class="avatar-frame">
                    {#if $userAvatar}
                        <img src={$userAvatar} alt="Avatar" />
                    {:else}
                        <div class="avatar-placeholder">{$dictionary[$locale].ACC_NO_IMAGE}</div>
                    {/if}
                </div>
                <label class="upload-btn">
                    {$dictionary[$locale].ACC_BTN_CHOOSE_AVATAR}
                    <input type="file" accept="image/*" on:change={handleAvatarUpload} hidden />
                </label>
            </div>

            <div class="system-id-box">
                <div class="id-label">{$dictionary[$locale].ACC_CITIZEN_ID}</div>
                <div class="id-value-container">
                    <span class="id-value">{data?.user?.citizen_id || 'SIB-PENDING'}</span>
                    <button type="button" class="copy-btn" on:click={copySystemId}>
                        {copied ? $dictionary[$locale].ACC_COPY_SUCCESS : $dictionary[$locale].ACC_COPY_BTN}
                    </button>
                </div>
            </div>

            <div class="form">
                <label for="username">{$dictionary[$locale].ACC_LABEL_IDENTIFIER}</label>
                <input id="username" type="text" bind:value={newUsername} autocomplete="off" spellcheck="false" maxlength="15" />

                <label for="password">{$dictionary[$locale].ACC_LABEL_PASSWORD}</label>
                <input id="password" type="password" bind:value={newPassword} placeholder="••••••••" />
                <p class="field-hint">{$dictionary[$locale].REG_PASSWORD_RULES}</p>

                <label for="privacy">{$dictionary[$locale].ACC_LABEL_PRIVACY}</label>
                <select id="privacy" bind:value={privacySetting} class="privacy-select">
                    <option value="PRIVATE">{$dictionary[$locale].ACC_PRIVACY_PRIVATE}</option>
                    <option value="FRIENDS">{$dictionary[$locale].ACC_PRIVACY_FRIENDS}</option>
                    <option value="GROUP ONLY">{$dictionary[$locale].ACC_PRIVACY_GROUPS}</option>
                    <option value="FRIENDS AND GROUP ONLY">{$dictionary[$locale].ACC_PRIVACY_GROUPS_FRIENDS}</option>
                    <option value="PUBLIC">{$dictionary[$locale].ACC_PRIVACY_PUBLIC}</option>
                </select>

                <div class="status-msg" class:success={settingsSuccess}>{settingsMessage}</div>

                <button class="action-btn" on:click={updateProfile}>{$dictionary[$locale].ACC_BTN_COMMIT}</button>
            </div>

            <button class="camera-init-btn" on:click={() => {
                appMode.set('INITIAL');

                import('$app/navigation').then(nav => nav.goto('/?bypass=true'));
            }}>
                {$dictionary[$locale].ACC_BTN_CAMERA_INIT}
            </button>

            <button class="logout-btn" on:click={handleLogout}>{$dictionary[$locale].ACC_BTN_LOGOUT}</button>
        </div>

        <div class="panel card-border">
            <h2 class="header">// COMPLIANCE CONNECTIONS</h2>

            <div class="connection-section">
                <div class="section-desc">
                    ESTABLISH SECURE TELEMETRY CONNECTIONS WITH OTHER REGISTERED CITIZENS OR ACCESS THE PUBLIC REGISTER DIRECTORY.
                </div>
                
                <div class="network-controls-group">
                    <button class="network-btn-panel" on:click={() => goto('/friends')}>
                        {$dictionary[$locale].ACC_BTN_NETWORK}
                    </button>
                    <button class="group-btn-panel" on:click={() => goto('/groups')}>
                        [ GROUPS ]
                    </button>
                    <button class="community-btn-panel" on:click={() => goto('/community')}>
                        {$dictionary[$locale].ACC_BTN_COMMUNITY}
                    </button>
                </div>
            </div>

            <div class="form" style="margin-bottom: 25px;">
                <label for="bio">CITIZEN DOSSIER (MAX 50 CHARS)</label>
                <input id="bio" type="text" bind:value={userBio} autocomplete="off" spellcheck="false" maxlength="50" placeholder="Enter short bio..." />
                <button class="action-btn" on:click={updateProfile} style="margin-top: 10px;">UPDATE DOSSIER</button>
            </div>

            <div class="discord-sync-box" style="margin-top: auto;">
                <div class="discord-title">{$dictionary[$locale].ACC_DISCORD_SYNC_TITLE}</div>
                {#if data?.user?.discord_username}
                    <div class="discord-status linked">
                        <span>{$dictionary[$locale].ACC_DISCORD_STATUS_LINKED} <strong class="discord-name">{data.user.discord_username}</strong></span>
                        <button type="button" class="discord-btn unlink" on:click={unlinkDiscord}>
                            {$dictionary[$locale].ACC_DISCORD_UNLINK_BTN}
                        </button>
                    </div>
                    <div class="id-card-section">
                        <div class="id-card-title">// CITIZEN SECURITY PASS</div>
                        <div class="id-card-desc">EXPORT A DIGITALLY VERIFIED SIBYL ID HOLOGRAPHIC PASS LOGGING COGNITIVE READINGS.</div>
                        <button type="button" class="id-card-btn" on:click={generateIDCard}>
                            GENERATE IDENTITY CARD
                        </button>
                        <canvas id="idCardCanvas" width="600" height="360" style="display: none;"></canvas>
                    </div>
                {:else}
                    <div class="discord-status unlinked">
                        <span>{$dictionary[$locale].ACC_DISCORD_STATUS_UNLINKED}</span>
                        <button type="button" class="discord-btn link" on:click={linkDiscord}>
                            {$dictionary[$locale].ACC_DISCORD_LINK_BTN}
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        <div class="panel card-border">
            <h2 class="header">{$dictionary[$locale].ACC_TREND_TITLE}</h2>

            {#if loading}
                <div class="message-state">{$dictionary[$locale].TREND_RETRIEVING}</div>
            {:else if history.length === 0}
                <div class="message-state">{$dictionary[$locale].ACC_NO_HISTORY}</div>
            {:else}
                <TimeGraph {history} width={400} height={300} />

                <div class="status" class:bad={lastCC > firstCC}>
                    {$dictionary[$locale].ACC_DIAGNOSTIC_TRACKING}: {lastCC > firstCC ? $dictionary[$locale].TREND_DETERIORATING : $dictionary[$locale].TREND_STABILIZING}
                </div>
            {/if}

            <div class="actions-row">
                <button class="trend-detail-btn" on:click={() => goto('/trends')}>
                    {$dictionary[$locale].ACC_BTN_VIEW_LOGS}
                </button>
                <button class="export-btn" on:click={() => window.open('/api/export-data', '_blank')}>
                    [ EXPORT MY DATA ]
                </button>
                <button class="terminal-btn" on:click={() => goto('/')}>
                    {$dictionary[$locale].ACC_BTN_RETURN_TERMINAL}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .account-container { position: absolute; inset: 0; background: #050505; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: #00ffcc; padding: 20px; overflow-y: auto; }
    .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 30px; width: 100%; max-width: 1400px; }
    .panel { background: #050505; padding: 30px; display: flex; flex-direction: column; }
    .card-border { border: 1px solid #00ffcc; box-shadow: 0 0 20px rgba(0, 255, 204, 0.1); }
    .header { font-size: 1rem; border-bottom: 1px solid rgba(0, 255, 204, 0.3); padding-bottom: 15px; margin: 0 0 25px 0; letter-spacing: 2px; font-weight: bold; }
    .avatar-section { display: flex; align-items: center; gap: 20px; margin-bottom: 25px; }
    .avatar-frame { width: 90px; height: 90px; border: 1px solid #00ffcc; background: #111; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; overflow: hidden; }
    .avatar-frame img { width: 100%; height: 100%; object-fit: cover; }
    .upload-btn { cursor: pointer; border: 1px dashed #00ffcc; padding: 8px; font-size: 0.8rem; text-align: center; }
    .upload-btn:hover { background: rgba(0, 255, 204, 0.1); }
    .form { display: flex; flex-direction: column; flex-grow: 1; }
    label { font-size: 0.85rem; margin-bottom: 8px; letter-spacing: 1px; display: block; }
    input { width: 100%; background: transparent; border: 1px solid rgba(0, 255, 204, 0.4); color: #fff; padding: 10px; margin-bottom: 20px; font-family: inherit; outline: none; }
    input:focus { border-color: #00ffcc; }
    .status-msg { height: 20px; color: #ff3333; margin-bottom: 15px; font-size: 0.85rem; }
    .status-msg.success { color: #00ffcc; text-shadow: 0 0 5px #00ffcc; }
    button { background: transparent; border: 1px solid #00ffcc; color: #00ffcc; padding: 12px; cursor: pointer; font-family: inherit; font-size: 0.95rem; letter-spacing: 1px; transition: all 0.2s; }
    button:hover { background: #00ffcc; color: #000; box-shadow: 0 0 15px #00ffcc; }
    .logout-btn { border-color: #ff3333; color: #ff3333; margin-top: 25px; font-size: 0.85rem; padding: 8px; }
    .logout-btn:hover { background: #ff3333; color: #000; box-shadow: 0 0 15px #ff3333; }
    .message-state { text-align: center; padding: 60px 0; border: 1px dashed rgba(0, 255, 204, 0.2); margin-bottom: 20px; }
    .status { margin-bottom: 35px; font-weight: bold; text-align: center; font-size: 1.05rem; }
    .status.bad { color: #ff3333; text-shadow: 0 0 10px #ff3333; }
    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 2px; pointer-events: none; z-index: 10; }
    .camera-init-btn {
        border-color: #00ffcc;
        color: #00ffcc;
        margin-top: 15px;
        font-size: 0.85rem;
        padding: 10px;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.4);
    }
    .camera-init-btn:hover {
        background: rgba(0, 255, 204, 0.1);
        color: #00ffcc;
        box-shadow: 0 0 12px rgba(0, 255, 204, 0.3);
    }
    .community-btn-panel:hover, .group-btn-panel:hover {
        background: rgba(0, 255, 204, 0.2);
        color: #fff;
    }
    .export-btn {
        width: 100%;
        padding: 12px;
        background: transparent;
        color: #aaaaaa;
        border: 1px solid #555;
        font-family: 'Courier New', Courier, monospace;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-top: 10px;
    }
    .export-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border-color: #fff;
    }
    .network-btn-panel, .group-btn-panel, .community-btn-panel {
        width: 100%;
        background: transparent;
        border: 1px solid #00ffcc;
        color: #00ffcc;
        margin-bottom: 15px;
        font-size: 0.85rem;
        padding: 12px;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.4);
        text-align: center;
        box-sizing: border-box;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.2s;
    }
    .network-btn-panel:hover, .group-btn-panel:hover, .community-btn-panel:hover {
        background: #00ffcc;
        color: #000;
        box-shadow: 0 0 12px rgba(0, 255, 204, 0.3);
    }
    .connection-section {
        margin-bottom: 25px;
    }
    .section-desc {
        font-size: 0.8rem;
        color: rgba(0, 255, 204, 0.75);
        line-height: 1.4;
        margin-bottom: 25px;
        border-left: 2px solid #00ffcc;
        padding-left: 10px;
    }
    .network-controls-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .privacy-select {
        width: 100%;
        background: #050505;
        border: 1px solid rgba(0, 255, 204, 0.4);
        color: #fff;
        padding: 10px;
        margin-bottom: 20px;
        font-family: inherit;
        outline: none;
        cursor: pointer;
    }
    .privacy-select:focus {
        border-color: #00ffcc;
    }
    .field-hint {
        font-size: 0.75rem;
        color: rgba(0, 255, 204, 0.6);
        margin-top: -15px;
        margin-bottom: 20px;
        line-height: 1.3;
    }
    .discord-sync-box {
        margin-bottom: 25px;
        padding: 15px;
        border: 1px dashed rgba(0, 255, 204, 0.3);
        background: rgba(0, 255, 204, 0.02);
    }
    .discord-title {
        font-size: 0.75rem;
        color: rgba(0, 255, 204, 0.7);
        letter-spacing: 1px;
        margin-bottom: 10px;
        font-weight: bold;
    }
    .discord-status {
        display: flex;
        flex-direction: column;
        gap: 10px;
        font-size: 0.9rem;
    }
    .discord-name {
        color: #fff;
        text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
    }
    .discord-btn {
        background: transparent;
        border: 1px solid rgba(0, 255, 204, 0.5);
        color: #00ffcc;
        padding: 6px 12px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 5px;
        text-align: center;
    }
    .discord-btn:hover {
        background: rgba(0, 255, 204, 0.15);
        border-color: #00ffcc;
        box-shadow: 0 0 10px rgba(0, 255, 204, 0.2);
    }
    .discord-btn.unlink {
        border-color: rgba(255, 51, 51, 0.5);
        color: #ff3333;
    }
    .discord-btn.unlink:hover {
        background: rgba(255, 51, 51, 0.15);
        border-color: #ff3333;
        box-shadow: 0 0 10px rgba(255, 51, 51, 0.2);
    }
    .system-id-box {
        margin-bottom: 25px;
        padding: 12px 15px;
        border: 1px dashed rgba(0, 255, 204, 0.3);
        background: rgba(0, 255, 204, 0.02);
    }
    .id-label {
        font-size: 0.75rem;
        color: rgba(0, 255, 204, 0.7);
        letter-spacing: 1px;
        margin-bottom: 5px;
    }
    .id-value-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 15px;
    }
    .id-value {
        font-family: monospace;
        font-size: 1.05rem;
        color: #fff;
        text-shadow: 0 0 5px rgba(255, 255, 255, 0.3);
        font-weight: bold;
    }
    .copy-btn {
        background: transparent;
        border: 1px solid rgba(0, 255, 204, 0.5);
        color: #00ffcc;
        padding: 4px 10px;
        font-size: 0.75rem;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 0;
    }
    .copy-btn:hover {
        background: rgba(0, 255, 204, 0.15);
        border-color: #00ffcc;
    }

    .actions-row { display: flex; flex-direction: column; gap: 15px; }
    .trend-detail-btn { border-color: #00ffcc; color: #00ffcc; }

    @media (max-width: 1100px) {
        .dashboard-grid {
            grid-template-columns: 1fr;
            gap: 20px;
        }
        .account-container {
            padding: 15px 15px 70px 15px;
            overflow-y: auto;
            align-items: flex-start;
        }
        .panel {
            padding: 15px;
        }
    }
    .id-card-section {
        margin-top: 20px;
        border-top: 1px dashed rgba(0, 255, 204, 0.3);
        padding-top: 15px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    .id-card-title {
        font-size: 0.8rem;
        font-weight: bold;
        color: #00ffcc;
        letter-spacing: 1px;
    }
    .id-card-desc {
        font-size: 0.7rem;
        color: rgba(0, 255, 204, 0.7);
        line-height: 1.3;
    }
    .id-card-btn {
        font-size: 0.8rem;
        padding: 8px;
        border-color: #00ffcc;
        color: #00ffcc;
        background: transparent;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.2s;
    }
    .id-card-btn:hover {
        background: #00ffcc;
        color: #000;
        box-shadow: 0 0 10px #00ffcc;
    }
</style>