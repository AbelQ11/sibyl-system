<script lang="ts">
    import { onMount } from 'svelte';
    import { currentUser, userAvatar, appMode } from '$lib/stores';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';

    let firstCC = 0;
    let lastCC = 0;
    let loading = true;

    let newUsername = $currentUser || '';
    let newPassword = '';
    let settingsMessage = '';
    let settingsSuccess = false;

    interface DailyData {
        date: string;
        firstCC: number;
        secondCC: number | null;
    }

    let dailyHistory: DailyData[] = [];

    const mapY = (cc: number) => 240 - (cc / 500) * 180; // Keep it safely in 60-240 range
    const mapX = (index: number, total: number) => {
        if (total <= 1) return 200;
        return 70 + (index / (total - 1)) * 260; // Keep X in 70-330 range
    };

    function processHistory(rawHistory: { cc: number, created_at: string }[]) {
        const groups: { [key: string]: number[] } = {};
        for (const item of rawHistory) {
            const dateStr = item.created_at ? item.created_at.substring(0, 10) : '';
            if (dateStr) {
                if (!groups[dateStr]) {
                    groups[dateStr] = [];
                }
                groups[dateStr].push(item.cc);
            }
        }

        const processed: DailyData[] = [];
        for (const date in groups) {
            const scans = groups[date];
            processed.push({
                date: formatDate(date),
                firstCC: scans[0],
                secondCC: scans.length > 1 ? scans[1] : null
            });
        }
        dailyHistory = processed;
    }

    function formatDate(dateStr: string) {
        try {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return `${parts[1]}/${parts[2]}`;
            }
        } catch (e) {}
        return dateStr;
    }

    onMount(async () => {
        if (!$currentUser) {
            goto('/auth');
            return;
        }

        try {
            const res = await fetch(`/api/stats?userId=${$currentUser}`);
            if (res.ok) {
                const data = await res.json();
                firstCC = data.first_cc || 0;
                lastCC = data.last_cc || 0;
                if (data.history) {
                    processHistory(data.history);
                }

                if (data.avatar) {
                    userAvatar.set(data.avatar);
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
                    newUsername,
                    newPassword
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
        goto('/auth');
    }
</script>

<div class="account-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="dashboard-grid">
        <!-- LEFT PANEL: BIO & ACCOUNT CONTROLS -->
        <div class="panel card-border">
            <div class="header">{$dictionary[$locale].ACC_TITLE}</div>

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

            <div class="form">
                <label for="username">{$dictionary[$locale].ACC_LABEL_IDENTIFIER}</label>
                <input id="username" type="text" bind:value={newUsername} autocomplete="off" spellcheck="false" />

                <label for="password">{$dictionary[$locale].ACC_LABEL_PASSWORD}</label>
                <input id="password" type="password" bind:value={newPassword} placeholder="••••••••" />

                <div class="status-msg" class:success={settingsSuccess}>{settingsMessage}</div>

                <button class="action-btn" on:click={updateProfile}>{$dictionary[$locale].ACC_BTN_COMMIT}</button>
            </div>

            <button class="camera-init-btn" on:click={() => {
                appMode.set('INITIAL');

                // REDIRECT: Go straight to the home scanner page with a temporary security bypass flag!
                import('$app/navigation').then(nav => nav.goto('/?bypass=true'));
            }}>
                {$dictionary[$locale].ACC_BTN_CAMERA_INIT}
            </button>

            <button class="logout-btn" on:click={handleLogout}>{$dictionary[$locale].ACC_BTN_LOGOUT}</button>
        </div>

        <!-- RIGHT PANEL: GRAPH RENDERING -->
        <div class="panel card-border">
            <div class="header">{$dictionary[$locale].ACC_TREND_TITLE}</div>

            {#if loading}
                <div class="message-state">{$dictionary[$locale].TREND_RETRIEVING}</div>
            {:else if dailyHistory.length === 0}
                <div class="message-state">{$dictionary[$locale].ACC_NO_HISTORY}</div>
            {:else}
                <svg viewBox="0 0 400 300" class="graph">
                    <!-- Grid Lines -->
                    {#each [100, 200, 300, 400, 500] as mark}
                        <line x1="0" y1={mapY(mark)} x2="400" y2={mapY(mark)} stroke="rgba(0, 255, 204, 0.15)" />
                    {/each}

                    <!-- Plot each day -->
                    {#each dailyHistory as day, index}
                        {@const x = mapX(index, dailyHistory.length)}
                        {@const y1 = mapY(day.firstCC)}
                        
                        <!-- If second scan exists, draw connecting line and second point -->
                        {#if day.secondCC !== null}
                            {@const y2 = mapY(day.secondCC)}
                            <!-- Connecting Line -->
                            <line x1={x} y1={y1} x2={x} y2={y2} 
                                  stroke={day.secondCC > 100 ? '#ff3333' : '#00ffcc'} 
                                  stroke-width="2" />
                            
                            <!-- Second scan point -->
                            <circle cx={x} cy={y2} r="5" fill={day.secondCC > 100 ? '#ff3333' : '#00ffcc'} />
                            <text x={x + 7} y={y2 + 3} fill={day.secondCC > 100 ? '#ff3333' : '#00ffcc'} font-size="9" font-family="monospace">2nd: {day.secondCC}</text>
                        {/if}

                        <!-- First scan point -->
                        <circle cx={x} cy={y1} r="5" fill={day.firstCC > 100 ? '#ff3333' : '#00ffcc'} />
                        <text x={x - 42} y={y1 + 3} fill="#00ffcc" font-size="9" font-family="monospace">1st: {day.firstCC}</text>

                        <!-- Date label -->
                        <text x={x} y="280" fill="#00ffcc" font-size="9" text-anchor="middle" font-family="monospace">{day.date}</text>
                    {/each}
                </svg>

                <div class="status" class:bad={lastCC > firstCC}>
                    {$dictionary[$locale].ACC_DIAGNOSTIC_TRACKING}: {lastCC > firstCC ? $dictionary[$locale].TREND_DETERIORATING : $dictionary[$locale].TREND_STABILIZING}
                </div>
            {/if}

            <div class="actions-row">
                <button class="trend-detail-btn" on:click={() => goto('/trends')}>
                    {$dictionary[$locale].ACC_BTN_VIEW_LOGS}
                </button>
                <button class="terminal-btn" on:click={() => goto('/')}>
                    {$dictionary[$locale].ACC_BTN_RETURN_TERMINAL}
                </button>
            </div>
        </div>
    </div>
</div>

<style>
    .account-container { position: fixed; inset: 0; background: #050505; display: flex; align-items: center; justify-content: center; font-family: 'Courier New', Courier, monospace; color: #00ffcc; padding: 20px; overflow-y: auto; }
    .dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; width: 100%; max-width: 1100px; }
    .panel { background: #050505; padding: 30px; display: flex; flex-direction: column; }
    .card-border { border: 1px solid #00ffcc; box-shadow: 0 0 20px rgba(0, 255, 204, 0.1); }
    .header { font-size: 1rem; border-bottom: 1px solid rgba(0, 255, 204, 0.3); padding-bottom: 15px; margin-bottom: 25px; letter-spacing: 2px; font-weight: bold; }
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
    .graph { width: 100%; border-bottom: 1px solid #00ffcc; border-left: 1px solid #00ffcc; margin-bottom: 15px; background: linear-gradient(rgba(0, 255, 204, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 204, 0.03) 1px, transparent 1px); background-size: 20px 20px; }
    .status { margin-bottom: 35px; font-weight: bold; text-align: center; font-size: 1.05rem; }
    .status.bad { color: #ff3333; text-shadow: 0 0 10px #ff3333; }
    .crt-overlay { position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 2px; pointer-events: none; z-index: 10; }
    .camera-init-btn {
        border-color: #00ffcc;
        color: #00ffcc;
        margin-top: 25px;
        font-size: 0.85rem;
        padding: 10px;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.4);
    }
    .camera-init-btn:hover {
        background: rgba(0, 255, 204, 0.1);
        color: #00ffcc;
        box-shadow: 0 0 12px rgba(0, 255, 204, 0.3);
    }
    .actions-row { display: flex; flex-direction: column; gap: 15px; }
    .trend-detail-btn { border-color: #00ffcc; color: #00ffcc; }
</style>