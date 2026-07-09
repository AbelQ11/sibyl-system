<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';

    let cosmetics: any[] = [];
    let inventory: any[] = [];
    let loading = true;
    let errorMsg = '';
    let successMsg = '';

    onMount(async () => {
        await loadShop();
    });

    async function loadShop() {
        loading = true;
        try {
            const res = await fetch('/api/shop');
            const data = await res.json();
            if (data.success) {
                cosmetics = data.cosmetics;
                inventory = data.inventory;
            } else {
                errorMsg = data.error || 'Failed to load inventory.';
            }
        } catch (e) {
            errorMsg = 'Network error.';
        }
        loading = false;
    }

    async function toggleEquip(item: any, isEquipped: boolean) {
        errorMsg = '';
        successMsg = '';
        const action = isEquipped ? 'unequip' : 'equip';
        try {
            const res = await fetch('/api/shop/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, cosmeticId: item.id })
            });
            const data = await res.json();
            if (data.success) {
                successMsg = data.message;
                if (item.type === 'interface_theme' || item.type === 'pointer_skin') {
                    window.location.reload();
                } else {
                    await loadShop();
                }
            } else {
                errorMsg = data.error;
            }
        } catch (e) {
            errorMsg = 'Action failed.';
        }
    }

    $: ownedItems = cosmetics.filter(c => inventory.some(i => i.cosmeticId === c.id));
    
    function isEquipped(id: number) {
        const item = inventory.find(i => i.cosmeticId === id);
        return item && item.equipped === 1;
    }
</script>

<svelte:head>
    <title>Sibyl Inventory</title>
</svelte:head>

<div class="shop-container" transition:fade>
    <div class="crt-overlay"></div>
    
    <div class="header-section">
        <h1>MY INVENTORY</h1>
        <button class="sys-btn nav-btn" on:click={() => goto('/shop')} style="margin-left: auto;">BACK TO SHOP</button>
        <button class="sys-btn nav-btn" on:click={() => goto('/account')}>BACK TO ACCOUNT</button>
    </div>

    {#if errorMsg}
        <div class="alert error">{errorMsg}</div>
    {/if}
    {#if successMsg}
        <div class="alert success">{successMsg}</div>
    {/if}

    {#if loading}
        <div style="text-align: center; margin-top: 50px;">LOADING INVENTORY...</div>
    {:else if ownedItems.length === 0}
        <div style="text-align: center; margin-top: 50px;">YOU DO NOT OWN ANY COSMETICS.</div>
    {:else}
        <div class="shop-grid">
            {#each ownedItems as item (item.id)}
                <div class="cosmetic-card" class:equipped={isEquipped(item.id)}>
                    <div class="card-type">{item.type.replace('_', ' ').toUpperCase()}</div>
                    <div class="card-name">{item.name}</div>
                    <div class="card-desc">{item.description}</div>
                    
                    {#if isEquipped(item.id)}
                        <button class="sys-btn unequip-btn" on:click={() => toggleEquip(item, true)}>
                            UNEQUIP
                        </button>
                    {:else}
                        <button class="sys-btn equip-btn" on:click={() => toggleEquip(item, false)}>
                            EQUIP
                        </button>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .shop-container { position: absolute; inset: 0; background: var(--bg-color, #050505); color: var(--main-color, #00ffcc); font-family: 'Courier New', Courier, monospace; overflow-y: auto; padding: 40px; }
    .header-section { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; border-bottom: 1px dashed var(--main-color, #00ffcc); padding-bottom: 20px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 1.5rem; text-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .sys-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 8px 15px; cursor: pointer; font-family: inherit; font-weight: bold; transition: all 0.2s; }
    .sys-btn:hover:not(:disabled) { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .alert { padding: 10px; margin-bottom: 20px; border: 1px solid; font-weight: bold; text-align: center; }
    .alert.error { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.1); }
    .alert.success { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.1)); }
    .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .cosmetic-card { border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 20px; display: flex; flex-direction: column; background: rgba(0, 0, 0, 0.5); transition: border-color 0.2s; }
    .cosmetic-card.equipped { border-color: var(--main-color, #00ffcc); box-shadow: inset 0 0 15px var(--border-color, rgba(0, 255, 204, 0.2)); }
    .card-type { font-size: 0.7rem; color: #888; margin-bottom: 5px; }
    .card-name { font-size: 1.1rem; font-weight: bold; margin-bottom: 10px; color: #fff; }
    .card-desc { font-size: 0.85rem; color: #aaa; flex-grow: 1; margin-bottom: 20px; }
    .equip-btn { width: 100%; border-color: #ffd700; color: #ffd700; }
    .equip-btn:hover { background: #ffd700; color: #000; box-shadow: 0 0 10px #ffd700; }
    .unequip-btn { width: 100%; border-color: #ff3333; color: #ff3333; }
    .unequip-btn:hover { background: #ff3333; color: #000; box-shadow: 0 0 10px #ff3333; }
</style>
