<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';

    let codes: any[] = [];
    let loading = true;
    let errorMsg = '';
    let successMsg = '';

    let newCode = '';
    let newReward = 100;
    let newMaxUses = 1;
    let editingId: number | null = null;

    onMount(async () => {
        await loadCodes();
    });

    async function loadCodes() {
        loading = true;
        try {
            const res = await fetch('/api/admin/codes');
            if (res.status === 401) {
                goto('/');
                return;
            }
            const data = await res.json();
            if (data.success) {
                codes = data.codes;
            } else {
                errorMsg = data.error || 'Failed to load promo codes.';
            }
        } catch (e) {
            errorMsg = 'Network error.';
        }
        loading = false;
    }

    async function saveCode() {
        errorMsg = '';
        successMsg = '';
        if (!newCode || newReward <= 0 || newMaxUses <= 0) {
            errorMsg = 'Invalid parameters for code.';
            return;
        }

        try {
            const method = editingId ? 'PUT' : 'POST';
            const body = JSON.stringify({ id: editingId, code: newCode.toUpperCase(), credits_reward: newReward, max_uses: newMaxUses });

            const res = await fetch('/api/admin/codes', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body
            });
            const data = await res.json();
            if (data.success) {
                successMsg = data.message;
                cancelEdit();
                await loadCodes();
            } else {
                errorMsg = data.error;
            }
        } catch (e) {
            errorMsg = 'Failed to save code.';
        }
    }

    function editCode(c: any) {
        editingId = c.id;
        newCode = c.code;
        newReward = c.credits_reward;
        newMaxUses = c.max_uses;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        editingId = null;
        newCode = '';
        newReward = 100;
        newMaxUses = 1;
        errorMsg = '';
        successMsg = '';
    }

    async function deleteCode(id: number) {
        if (!confirm('Delete this promo code?')) return;
        try {
            const res = await fetch('/api/admin/codes', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                await loadCodes();
            }
        } catch (e) {
            alert('Failed to delete');
        }
    }
</script>

<svelte:head>
    <title>Sibyl Admin | Promo Codes</title>
</svelte:head>

<div class="admin-container" transition:fade>
    <div class="crt-overlay"></div>
    
    <div class="header-section">
        <h1>PROMO CODE MANAGEMENT</h1>
        <button class="sys-btn nav-btn" on:click={() => goto('/admin')} style="margin-left: auto;">BACK TO ADMIN</button>
    </div>

    {#if errorMsg}
        <div class="alert error">{errorMsg}</div>
    {/if}
    {#if successMsg}
        <div class="alert success">{successMsg}</div>
    {/if}

    <div class="generate-box">
        <h3>{editingId ? 'EDIT PROMO CODE' : 'GENERATE NEW CODE'}</h3>
        <div class="form-row">
            <input type="text" bind:value={newCode} placeholder="CODE STRING (e.g. SIBYL2026)" />
            <input type="number" bind:value={newReward} placeholder="CREDIT REWARD" />
            <input type="number" bind:value={newMaxUses} placeholder="MAX USES" />
            <button class="sys-btn" on:click={saveCode}>{editingId ? 'UPDATE' : 'GENERATE'}</button>
            {#if editingId}
                <button class="sys-btn" on:click={cancelEdit} style="border-color: #aaa; color: #aaa;">CANCEL</button>
            {/if}
        </div>
    </div>

    <table class="codes-table">
        <thead>
            <tr>
                <th>CODE</th>
                <th>REWARD</th>
                <th>USES</th>
                <th>CREATED BY</th>
                <th>CREATED AT</th>
            </tr>
        </thead>
        <tbody>
            {#each codes as code}
                <tr>
                    <td style="font-weight: bold;">{code.code}</td>
                    <td style="color: #ffd700;">{code.credits_reward}</td>
                    <td>{code.current_uses} / {code.max_uses}</td>
                    <td>{code.creatorName || 'SYSTEM'}</td>
                    <td>{new Date(code.created_at).toLocaleString()}</td>
                    <td>
                        <div style="display:flex; gap: 5px;">
                            <button class="sys-btn" on:click={() => editCode(code)}>EDIT</button>
                            <button class="sys-btn" style="border-color: #ff3333; color: #ff3333;" on:click={() => deleteCode(code.id)}>REMOVE</button>
                        </div>
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>

<style>
    .admin-container { position: absolute; inset: 0; background: var(--bg-color, #050505); color: var(--main-color, #00ffcc); font-family: 'Courier New', Courier, monospace; overflow-y: auto; padding: 40px; }
    .header-section { display: flex; flex-wrap: wrap; align-items: center; gap: 20px; border-bottom: 1px dashed var(--main-color, #00ffcc); padding-bottom: 20px; margin-bottom: 20px; }
    h1 { margin: 0; font-size: 1.5rem; text-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .sys-btn { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); padding: 8px 15px; cursor: pointer; font-family: inherit; font-weight: bold; transition: all 0.2s; }
    .sys-btn:hover { background: var(--main-color, #00ffcc); color: #000; box-shadow: 0 0 10px var(--main-color, #00ffcc); }
    .alert { padding: 10px; margin-bottom: 20px; border: 1px solid; font-weight: bold; text-align: center; }
    .alert.error { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.1); }
    .alert.success { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.1)); }
    
    .generate-box { border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 20px; margin-bottom: 30px; background: rgba(0, 0, 0, 0.5); }
    .generate-box h3 { margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; }
    .form-row { display: flex; gap: 15px; flex-wrap: wrap; }
    .form-row input { flex: 1; background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px; font-family: inherit; min-width: 150px; }
    
    .codes-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    .codes-table th, .codes-table td { border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 12px; text-align: left; }
    .codes-table th { background: var(--border-color, rgba(0, 255, 204, 0.1)); font-weight: bold; }
    .codes-table tr:hover td { background: var(--border-color, rgba(0, 255, 204, 0.05)); }
</style>
