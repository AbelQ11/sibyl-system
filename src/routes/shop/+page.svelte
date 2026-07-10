<script lang="ts">
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';
    import { enhance } from '$app/forms';
    import { currentUser as currentUsername, userAvatar as currentUserAvatar } from '$lib/stores';

    export let data: any;
    export let form: any;

    $: credits = data.credits || 0;
    $: cosmetics = data.cosmetics || [];
    $: inventory = data.inventory || [];
    $: hasClaimedDaily = data.hasClaimedDaily || false;
    $: role = data.role || 'CITIZEN';

    let errorMsg = '';
    let successMsg = '';

    let searchQuery = '';
    let activeFilter = 'ALL';
    let promoCode = '';
    let previewItem: any = null;

    $: if (form) {
        if (form.success) {
            successMsg = form.message;
            errorMsg = '';
            promoCode = '';
        } else if (form.error) {
            errorMsg = form.error;
            successMsg = '';
        }
    }

    function isOwned(id: number) {
        return inventory.some((i: any) => i.cosmeticId === id);
    }

    $: filteredCosmetics = cosmetics.filter((c: any) => {
        if (activeFilter !== 'ALL' && c.type !== activeFilter) return false;
        if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });
</script>

<svelte:head>
    <title>Sibyl Shop | Economy & Cosmetics</title>
</svelte:head>

<div class="shop-container" transition:fade>
    <div class="crt-overlay"></div>
    
    <div class="header-section">
        <h1>SIBYL SYSTEM SHOP</h1>
        <div class="credits-display" style="display: flex; align-items: center;">
            <span>BALANCE: <span class="credit-value">{credits}</span> CREDITS</span>
            {#if !hasClaimedDaily}
                <form method="POST" action="?/daily" use:enhance style="display: inline-block; margin-left: 15px;">
                    <button class="sys-btn" style="border-color: #ffd700; color: #ffd700; padding: 4px 10px;">DAILY</button>
                </form>
            {/if}
        </div>
        <div class="promo-box">
            <form method="POST" action="?/redeem" use:enhance style="display: flex; gap: 10px; width: 100%;">
                <input type="text" name="code" bind:value={promoCode} placeholder="ENTER PROMO CODE..." />
                <button class="sys-btn">REDEEM</button>
            </form>
            {#if role === 'ADMIN'}
                <button class="sys-btn" style="border-color: #ff3333; color: #ff3333;" on:click={() => goto('/admin/codes')}>CREATE CODE</button>
                <button class="sys-btn" style="border-color: #ff00ff; color: #ff00ff;" on:click={() => goto('/admin/cosmetics')}>CREATE COSMETIC</button>
            {/if}
        </div>
        <button class="sys-btn nav-btn" on:click={() => goto('/inventory')}>MY INVENTORY</button>
        <button class="sys-btn nav-btn" on:click={() => goto('/account')}>BACK TO ACCOUNT</button>
    </div>

    {#if errorMsg}
        <div class="alert error">{errorMsg}</div>
    {/if}
    {#if successMsg}
        <div class="alert success">{successMsg}</div>
    {/if}

    <div class="filters">
        <input type="text" class="search-bar" bind:value={searchQuery} placeholder={$dictionary[$locale].SHOP_SEARCH} />
        <div class="filter-tabs">
            <button class:active={activeFilter === 'ALL'} on:click={() => activeFilter = 'ALL'}>{$dictionary[$locale].SHOP_FILTER_ALL}</button>
            <button class:active={activeFilter === 'avatar_border'} on:click={() => activeFilter = 'avatar_border'}>{$dictionary[$locale].SHOP_FILTER_AVATAR}</button>
            <button class:active={activeFilter === 'name_effect'} on:click={() => activeFilter = 'name_effect'}>{$dictionary[$locale].SHOP_FILTER_NAME}</button>
            <button class:active={activeFilter === 'interface_theme'} on:click={() => activeFilter = 'interface_theme'}>{$dictionary[$locale].SHOP_FILTER_THEME}</button>
            <button class:active={activeFilter === 'pointer_skin'} on:click={() => activeFilter = 'pointer_skin'}>{$dictionary[$locale].SHOP_FILTER_POINTER}</button>
        </div>
    </div>

    <div class="shop-grid">
        {#each filteredCosmetics as item (item.id)}
            <div class="cosmetic-card {previewItem === item && item.type === 'pointer_skin' ? item.value : ''}" class:owned={isOwned(item.id)} on:mouseenter={() => previewItem = item} on:mouseleave={() => previewItem = null}>
                <div class="card-type">{item.type.replace('_', ' ').toUpperCase()}</div>
                <div class="card-name">{item.name}</div>
                <div class="card-desc">{item.description}</div>
                
                {#if isOwned(item.id)}
                    <button class="sys-btn owned-btn" disabled>OWNED</button>
                {:else}
                    <form method="POST" action="?/buy" use:enhance style="width: 100%;">
                        <input type="hidden" name="cosmeticId" value={item.id} />
                        <button class="sys-btn buy-btn" disabled={credits < item.price}>
                            BUY - {item.price} CREDITS
                        </button>
                    </form>
                {/if}
            </div>
        {/each}
    </div>

    {#if previewItem}
        <div class="preview-panel" transition:fade>
            <div class="preview-title">{$dictionary[$locale].SHOP_PREVIEW_TITLE}</div>
            {#if previewItem.type === 'avatar_border'}
                <div class="avatar-wrapper {previewItem.value}" style="width: 100px; height: 100px;">
                    {#if $currentUserAvatar}
                        <img src={$currentUserAvatar} alt="Preview" class="chat-avatar" style="width: 100%; height: 100%;" />
                    {:else}
                        <div style="width: 100%; height: 100%; background: #222; display: flex; align-items: center; justify-content: center; color: #555; border-radius: inherit;">NO IMG</div>
                    {/if}
                </div>
            {:else if previewItem.type === 'name_effect'}
                <div class="sender-name {previewItem.value}" data-text="{$currentUsername?.toUpperCase()}">
                    {$currentUsername?.toUpperCase()}
                </div>
            {:else if previewItem.type === 'interface_theme'}
                <div class="theme-preview-box {previewItem.value}">
                    <div class="theme-sample">
                        <div class="sample-header">SIBYL TERMINAL</div>
                        <div class="sample-body">
                            <span style="color: var(--preview-main);">> CONNECTION ESTABLISHED</span>
                        </div>
                    </div>
                </div>
            {:else if previewItem.type === 'pointer_skin'}
                <div class="pointer-preview-box {previewItem.value}">
                    {$dictionary[$locale].SHOP_PREVIEW_POINTER}
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .shop-container { position: absolute; inset: 0; background: var(--bg-color, #050505); color: var(--main-color, #00ffcc); font-family: 'Courier New', Courier, monospace; overflow-y: auto; padding: 40px; }
    .header-section { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; border-bottom: 1px dashed var(--main-color, #00ffcc); padding-bottom: 20px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 1.5rem; text-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .credits-display { margin-left: auto; font-size: 1.2rem; font-weight: bold; border: 1px solid #ffd700; color: #ffd700; padding: 10px; box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); }
    .promo-box { display: flex; gap: 10px; }
    .promo-box input { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 8px; font-family: inherit; }
    .sys-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 8px 15px; cursor: pointer; font-family: inherit; font-weight: bold; transition: all 0.2s; }
    .sys-btn:hover:not(:disabled) { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .sys-btn:disabled { opacity: 0.5; cursor: not-allowed; border-color: #555; color: #555; }
    .alert { padding: 10px; margin-bottom: 20px; border: 1px solid; font-weight: bold; text-align: center; }
    .alert.error { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.1); }
    .alert.success { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.1)); }
    .filters { display: flex; flex-direction: column; gap: 15px; margin-bottom: 30px; }
    .search-bar { width: 100%; max-width: 400px; padding: 10px; background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; font-family: inherit; }
    .filter-tabs { display: flex; gap: 10px; }
    .filter-tabs button { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 8px 15px; cursor: pointer; font-family: inherit; }
    .filter-tabs button.active { background: var(--border-color, rgba(0, 255, 204, 0.2)); box-shadow: inset 0 0 5px var(--main-color, #00ffcc); }
    .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .cosmetic-card { border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 20px; display: flex; flex-direction: column; background: rgba(0, 0, 0, 0.5); transition: border-color 0.2s; }
    .cosmetic-card:hover { border-color: var(--main-color, #00ffcc); }
    .cosmetic-card.owned { border-color: #555; opacity: 0.7; }
    .card-type { font-size: 0.7rem; color: #888; margin-bottom: 5px; }
    .card-name { font-size: 1.1rem; font-weight: bold; margin-bottom: 10px; color: #fff; }
    .card-desc { font-size: 0.85rem; color: #aaa; flex-grow: 1; margin-bottom: 20px; }
    .buy-btn { width: 100%; }
    .owned-btn { width: 100%; border-color: #555; color: #555; }
    .preview-panel { position: fixed; bottom: 40px; right: 40px; width: 300px; padding: 20px; border: 1px solid var(--main-color, #00ffcc); background: rgba(5, 5, 5, 0.95); box-shadow: 0 0 20px var(--border-color, rgba(0, 255, 204, 0.2)); z-index: 100; display: flex; flex-direction: column; align-items: center; gap: 20px; pointer-events: none; }
    .preview-title { font-size: 0.8rem; letter-spacing: 2px; border-bottom: 1px dashed var(--main-color, #00ffcc); padding-bottom: 5px; width: 100%; text-align: center; }
    
    /* Mock styles for preview */
    .chat-avatar { width: 60px; height: 60px; background: #222; }
    .sender-name { font-size: 1.2rem; font-weight: bold; }

    .theme-preview-box {
        width: 100%;
        padding: 10px;
        background: var(--preview-bg, var(--bg-color, #050505));
        box-sizing: border-box;
    }

    .mini-hud { border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 5px; height: 100px; }
    .mini-nav { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 5px; display: flex; justify-content: space-between; align-items: center; }
    .mini-logo { color: var(--preview-main); font-weight: bold; font-size: 0.7rem; text-shadow: 0 0 5px var(--preview-glow); }
    .mini-body { padding: 5px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; }
    .mini-msg { color: #fff; font-size: 0.6rem; }
    .mini-btn { border: 1px solid var(--preview-main); color: var(--preview-main); font-size: 0.5rem; padding: 2px 5px; background: transparent; text-shadow: 0 0 5px var(--preview-glow); }
    .mini-btn.main { box-shadow: 0 0 5px var(--preview-glow); }
    
    .pointer-preview-box {
        width: 100%;
        padding: 20px;
        text-align: center;
        background: var(--preview-bg, var(--bg-color, #050505));
        border: 1px dashed var(--main-color, #00ffcc);
        color: var(--main-color, #00ffcc);
        font-size: 0.8rem;
    }

    @media (max-width: 768px) {
        .shop-container { padding: 15px; }
        .shop-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
        .preview-panel {
            position: relative;
            bottom: auto;
            right: auto;
            width: 100%;
            margin-bottom: 20px;
        }
        .header-section {
            flex-direction: column;
            align-items: stretch;
            gap: 10px;
        }
        .credits-display { margin-left: 0; text-align: center; }
    }
</style>
