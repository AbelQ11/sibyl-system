<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition';
    import ColorPicker from '$lib/components/ColorPicker.svelte';

    let cosmetics: any[] = [];
    let loading = true;
    let errorMsg = '';
    let successMsg = '';

    // Form fields
    let newType = 'avatar_border';
    let newName = '';
    let newPrice = 200;
    let newValueClass = '';
    let newDescription = '';
    let newCss = '';
    let editingId: number | null = null;

    // Builder fields
    let buildColor = 'var(--main-color, #00ffcc)';
    let buildGlowColor = 'var(--main-color, #00ffcc)';
    let buildBorderWidth = 2;
    let buildBgColor = 'var(--bg-color, #050505)';

    onMount(async () => {
        await loadCosmetics();
    });

    async function loadCosmetics() {
        loading = true;
        try {
            const res = await fetch('/api/admin/cosmetics');
            if (res.status === 401 || res.status === 403) {
                goto('/');
                return;
            }
            const data = await res.json();
            if (data.success) {
                cosmetics = data.cosmetics;
            } else {
                errorMsg = data.error || 'Failed to load cosmetics.';
            }
        } catch (e) {
            errorMsg = 'Network error.';
        }
        loading = false;
    }

    $: builderPreviewCss = '';
    $: {
        const cls = newValueClass ? newValueClass : 'my-new-class';
        if (newType === 'avatar_border') {
            builderPreviewCss = `.avatar-wrapper.${cls} {\n  border: ${buildBorderWidth}px solid ${buildColor};\n  box-shadow: 0 0 10px ${buildGlowColor}, inset 0 0 10px ${buildGlowColor};\n}\n`;
        } else if (newType === 'name_effect') {
            builderPreviewCss = `.sender-name.${cls} {\n  text-shadow: 0 0 5px ${buildGlowColor}, 0 0 10px ${buildGlowColor};\n  color: ${buildColor};\n}\n`;
        } else if (newType === 'interface_theme') {
            builderPreviewCss = `.theme-preview-box.${cls} { --preview-main: ${buildColor}; --preview-bg: ${buildBgColor}; --preview-glow: ${buildGlowColor}80; }\n.app-wrapper.${cls} {\n  --main-color: ${buildColor} !important;\n  --main-glow: ${buildGlowColor} !important;\n  --bg-color: ${buildBgColor} !important;\n}\n`;
        } else if (newType === 'pointer_skin') {
            builderPreviewCss = `.${cls}, .${cls} * {\n  cursor: crosshair !important;\n}\n`;
        }
    }

    function generateBasicCss() {
        newCss = builderPreviewCss + newCss;
    }

    async function saveCosmetic() {
        errorMsg = '';
        successMsg = '';
        if (!newName || !newValueClass || !newDescription) {
            errorMsg = 'Please fill out all required fields.';
            return;
        }

        try {
            const finalCss = newCss.trim() ? newCss : builderPreviewCss;
            const method = editingId ? 'PUT' : 'POST';
            const body = JSON.stringify({
                id: editingId,
                type: newType,
                name: newName,
                price: newPrice,
                value: newValueClass,
                description: newDescription,
                css_rules: finalCss
            });

            const res = await fetch('/api/admin/cosmetics', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body
            });
            const data = await res.json();
            if (data.success) {
                successMsg = data.message;
                cancelEdit();
                await loadCosmetics();
                
                // Inject new CSS temporarily into the document head so preview works instantly without refresh
                if (newCss) {
                    const style = document.createElement('style');
                    style.innerHTML = newCss;
                    document.head.appendChild(style);
                }
            } else {
                errorMsg = data.error;
            }
        } catch (e) {
            errorMsg = 'Failed to save cosmetic.';
        }
    }

    function editCosmetic(c: any) {
        editingId = c.id;
        newType = c.type;
        newName = c.name;
        newPrice = c.price;
        newValueClass = c.value;
        newDescription = c.description;
        newCss = c.css_rules || '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function cancelEdit() {
        editingId = null;
        newName = '';
        newValueClass = '';
        newDescription = '';
        newCss = '';
        errorMsg = '';
        successMsg = '';
    }

    async function deleteCosmetic(id: number) {
        if (!confirm('Delete this cosmetic? Users who own it will lose access.')) return;
        try {
            const res = await fetch('/api/admin/cosmetics', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                await loadCosmetics();
            }
        } catch (e) {
            alert('Failed to delete');
        }
    }
</script>

<svelte:head>
    <title>Sibyl Admin | Cosmetics Generator</title>
</svelte:head>

<div class="admin-container" transition:fade>
    <div class="crt-overlay"></div>
    
    <div class="header-section">
        <h1>COSMETICS GENERATOR</h1>
        <button class="sys-btn nav-btn" on:click={() => goto('/admin')} style="margin-left: auto;">BACK TO ADMIN</button>
    </div>

    {#if errorMsg}
        <div class="alert error">{errorMsg}</div>
    {/if}
    {#if successMsg}
        <div class="alert success">{successMsg}</div>
    {/if}

    <div class="generator-layout">
        <!-- FORM -->
        <div class="generate-box">
            <h3>{editingId ? 'EDIT COSMETIC' : 'CREATE NEW COSMETIC'}</h3>
            
            <div class="form-group">
                <label>TYPE</label>
                <select bind:value={newType}>
                    <option value="avatar_border">AVATAR BORDER</option>
                    <option value="name_effect">NAME EFFECT</option>
                    <option value="interface_theme">INTERFACE THEME</option>
                    <option value="pointer_skin">POINTER SKIN</option>
                </select>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label>NAME</label>
                    <input type="text" bind:value={newName} placeholder="e.g. Neon Fire" />
                </div>
                <div class="form-group">
                    <label>PRICE</label>
                    <input type="number" bind:value={newPrice} />
                </div>
            </div>

            <div class="form-group">
                <label>CSS CLASS VALUE (Must be unique)</label>
                <input type="text" bind:value={newValueClass} placeholder="e.g. neon-fire" />
            </div>

            <div class="form-group">
                <label>DESCRIPTION</label>
                <input type="text" bind:value={newDescription} placeholder="Describe the effect..." />
            </div>

            <div class="color-picker-box">
                <label>VISUAL BUILDER</label>
                <div class="builder-inputs">
                    {#if newType === 'avatar_border'}
                        <div class="builder-field"><ColorPicker bind:color={buildColor} label="Border Color" /></div>
                        <div class="builder-field"><ColorPicker bind:color={buildGlowColor} label="Glow Color" /></div>
                        <div class="builder-field"><label>Border Width (px)</label><input type="number" bind:value={buildBorderWidth} min="1" max="10" /></div>
                    {:else if newType === 'name_effect'}
                        <div class="builder-field"><ColorPicker bind:color={buildColor} label="Text Color" /></div>
                        <div class="builder-field"><ColorPicker bind:color={buildGlowColor} label="Glow Color" /></div>
                    {:else if newType === 'interface_theme'}
                        <div class="builder-field"><ColorPicker bind:color={buildColor} label="Main Color" /></div>
                        <div class="builder-field"><ColorPicker bind:color={buildGlowColor} label="Glow Color" /></div>
                        <div class="builder-field"><ColorPicker bind:color={buildBgColor} label="Background Color" /></div>
                    {:else if newType === 'pointer_skin'}
                        <div class="builder-field" style="grid-column: span 3;"><p style="font-size: 0.8rem; color: #aaa;">Visual builder not supported for cursors. Write raw CSS below using standard cursor rules, e.g., <code>cursor: crosshair;</code> or <code>cursor: url('...'), auto;</code></p></div>
                    {/if}
                </div>
                <button class="sys-btn" on:click={generateBasicCss} style="margin-top: 10px;">APPEND GENERATED CSS</button>
            </div>

            <div class="form-group">
                <label>RAW CSS RULES</label>
                <textarea bind:value={newCss} rows="8" placeholder="Write custom raw CSS here..."></textarea>
            </div>

            <button class="sys-btn generate-btn" on:click={saveCosmetic}>
                {editingId ? 'UPDATE COSMETIC' : 'CREATE COSMETIC'}
            </button>
            {#if editingId}
                <button class="sys-btn" on:click={cancelEdit} style="width: 100%; margin-top: 5px; border-color: #aaa; color: #aaa;">CANCEL EDIT</button>
            {/if}
        </div>

        <!-- LIVE PREVIEW -->
        <div class="preview-box">
            <h3>LIVE PREVIEW</h3>
            <p class="help-text">Testing class: <strong>{newValueClass || 'none'}</strong></p>
            {@html `<style>${newCss.trim() ? newCss : builderPreviewCss}</style>`}
            
            <div class="preview-stage">
                {#if newType === 'avatar_border'}
                    <div class="avatar-wrapper {newValueClass}">
                        <div class="chat-avatar blank"></div>
                    </div>
                {:else if newType === 'name_effect'}
                    <div class="sender-name {newValueClass}" data-text="PreviewUser">PreviewUser</div>
                {:else if newType === 'interface_theme'}
                    <div class="theme-preview-box {newValueClass}">
                        <div class="theme-sample">
                            <div class="sample-header">SIBYL TERMINAL</div>
                            <div class="sample-body">
                                <span style="color: var(--preview-main);">> SYSTEM OK</span>
                            </div>
                        </div>
                    </div>
                {:else if newType === 'pointer_skin'}
                    <div class="pointer-preview-box {newValueClass}" style="width: 100%; padding: 20px; text-align: center; border: 1px dashed var(--main-color, #00ffcc);">
                        HOVER HERE TO TEST POINTER
                    </div>
                {/if}
            </div>
        </div>
    </div>

    <!-- EXISTING LIST -->
    <h3 style="margin-top: 40px;">EXISTING COSMETICS</h3>
    <table class="codes-table">
        <thead>
            <tr>
                <th>ID</th>
                <th>TYPE</th>
                <th>NAME</th>
                <th>VALUE</th>
                <th>PRICE</th>
                <th>CSS ATTACHED</th>
                <th>ACTIONS</th>
            </tr>
        </thead>
        <tbody>
            {#each cosmetics as c}
                <tr>
                    <td>{c.id}</td>
                    <td>{c.type}</td>
                    <td>{c.name}</td>
                    <td>{c.value}</td>
                    <td style="color: #ffd700;">{c.price}</td>
                    <td>{c.css_rules ? 'YES' : 'NO'}</td>
                    <td>
                        <div style="display:flex; gap: 5px;">
                            <button class="sys-btn" on:click={() => editCosmetic(c)}>EDIT</button>
                            <button class="sys-btn delete-btn" on:click={() => deleteCosmetic(c.id)}>REMOVE</button>
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
    .delete-btn { border-color: #ff3333; color: #ff3333; }
    .delete-btn:hover { background: #ff3333; color: #fff; box-shadow: 0 0 10px #ff3333; }
    
    .alert { padding: 10px; margin-bottom: 20px; border: 1px solid; font-weight: bold; text-align: center; }
    .alert.error { border-color: #ff3333; color: #ff3333; background: rgba(255, 51, 51, 0.1); }
    .alert.success { border-color: var(--main-color, #00ffcc); color: var(--main-color, #00ffcc); background: var(--border-color, rgba(0, 255, 204, 0.1)); }
    
    .generator-layout { display: flex; gap: 30px; align-items: flex-start; flex-wrap: wrap; }
    .generate-box { flex: 2; min-width: 400px; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 20px; background: rgba(0, 0, 0, 0.5); }
    .generate-box h3 { margin-top: 0; margin-bottom: 15px; font-size: 1.1rem; border-bottom: 1px dashed var(--main-color, #00ffcc); padding-bottom: 10px;}
    
    .preview-box { flex: 1; min-width: 300px; border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 20px; background: rgba(0, 0, 0, 0.5); position: sticky; top: 40px;}
    .preview-box h3 { margin-top: 0; margin-bottom: 5px; font-size: 1.1rem; }
    .preview-stage { margin-top: 20px; padding: 30px; border: 1px dashed #555; display: flex; justify-content: center; align-items: center; min-height: 150px; background: #0a0a0a; }

    .form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 15px; flex: 1; }
    .form-row { display: flex; gap: 15px; }
    label { font-size: 0.8rem; color: #aaa; font-weight: bold; }
    .form-row input { flex: 1; background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px; font-family: inherit; min-width: 150px; }
    input[type="text"], input[type="number"], select, textarea { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 10px; font-family: inherit; width: 100%; box-sizing: border-box;}
    textarea { font-family: monospace; font-size: 0.9rem; resize: vertical; }
    
    .color-picker-box { border: 1px dashed var(--main-color, #00ffcc); padding: 15px; margin-bottom: 15px; background: var(--border-color, rgba(0, 255, 204, 0.05)); }
    .builder-inputs { display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px; align-items: flex-start; }
    .builder-field { display: flex; flex-direction: column; gap: 5px; }
    .builder-field label { font-size: 0.7rem; color: #888; }
    .builder-field input[type="number"] { background: transparent; border: 1px solid var(--main-color, #00ffcc); color: #fff; padding: 5px; width: 60px; height: 35px; box-sizing: border-box; font-family: inherit; }
    .help-text { font-size: 0.75rem; color: #888; margin-top: 5px; }

    .generate-btn { width: 100%; padding: 15px; font-size: 1.1rem; margin-top: 10px; }

    .codes-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .codes-table th, .codes-table td { border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3)); padding: 12px; text-align: left; }
    .codes-table th { background: var(--border-color, rgba(0, 255, 204, 0.1)); font-weight: bold; }
    .codes-table tr:hover td { background: var(--border-color, rgba(0, 255, 204, 0.05)); }

    /* Mock styles for preview */
    .chat-avatar { width: 60px; height: 60px; background: #222; }
    .sender-name { font-size: 1.2rem; font-weight: bold; }

    .theme-preview-box { width: 100%; padding: 10px; background: var(--preview-bg, var(--bg-color, #050505)); box-sizing: border-box; }
    .mini-hud { border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 5px; height: 100px; }
    .mini-nav { border-bottom: 1px solid rgba(255,255,255,0.1); padding: 5px; display: flex; justify-content: space-between; align-items: center; }
    .mini-logo { color: var(--preview-main); font-weight: bold; font-size: 0.7rem; text-shadow: 0 0 5px var(--preview-glow); }
    .mini-body { padding: 5px; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 10px; }
    .mini-msg { color: #fff; font-size: 0.6rem; }
    .mini-btn { border: 1px solid var(--preview-main); color: var(--preview-main); font-size: 0.5rem; padding: 2px 5px; background: transparent; text-shadow: 0 0 5px var(--preview-glow); }
    .mini-btn.main { box-shadow: 0 0 5px var(--preview-glow); }
</style>
