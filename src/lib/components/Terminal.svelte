<script lang="ts">
    import { dictionary, locale } from '$lib/i18n';
    import { appMode, currentUser, terminalAutoTrigger } from '$lib/stores';
    import { fade } from 'svelte/transition';
    import { tick } from 'svelte';

    let input = '';
    let output = [$dictionary[$locale].INIT];
    let terminalState: 'COMMAND' | 'AWAITING_TEXT' | 'AWAITING_SCAN' | 'AWAITING_CHOICE' = 'COMMAND';
    let terminalWindow: HTMLElement;
    let isBreathingAllowed = false;

    $: if ($terminalAutoTrigger) {
        const trigger = $terminalAutoTrigger;
        terminalAutoTrigger.set(null);
        handleCommand(trigger);
    }

    async function handleCommand(eventOrCommand?: string | KeyboardEvent) {
        if (eventOrCommand instanceof KeyboardEvent) {
            if (eventOrCommand.key !== 'Enter') return;
            eventOrCommand = undefined;
        }

        const cmdText = typeof eventOrCommand === 'string' ? eventOrCommand : input;
        const cmd = cmdText.trim();
        if (!cmd) return;

        const upperCmd = cmd.toUpperCase();

        if (typeof window !== 'undefined' && (window as any).umami) {
            (window as any).umami.track('terminal-command', { command: upperCmd });
        }

        if (terminalState === 'AWAITING_CHOICE') {
            const chosenBreathing = upperCmd === 'B' || upperCmd === 'R';
            if (chosenBreathing && isBreathingAllowed) {
                appMode.set('BREATHING');
            } else {
                if (chosenBreathing && !isBreathingAllowed) {
                    output = [...output, `> ${cmd}`, "BREATHING PROTOCOL DENIED: COEFFICIENT WITHIN ACCEPTABLE RANGE."];
                } else if (upperCmd === 'P') {
                    output = [...output, `> ${cmd}`, "PSYCHOLOGY MODE ACTIVATED."];
                } else {
                    output = [...output, `> ${cmd}`, "SELECTION DECLINED. PSYCHOLOGY MODE ACTIVATED."];
                }
            }
            terminalState = 'COMMAND';
            input = '';
            await updateScroll();
            return;
        }

        if (terminalState === 'AWAITING_TEXT') {
            output = [...output, `> ${cmd}`, "PROCESSING AGGREGATE READOUTS..."];
            input = '';
            await updateScroll();

            try {
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: cmd, userId: null })
                });
                const data = await res.json();
                
                if (typeof window !== 'undefined' && (window as any).umami) {
                    (window as any).umami.track('terminal-scan', { cc: data.cc });
                }

                const resultBlock = `CRIME COEFFICIENT: ${data.cc}\nANALYSIS: ${data.analysis}`;
                isBreathingAllowed = data.cc > 100;

                const choiceText = isBreathingAllowed ? $dictionary[$locale].EVAL_CHOICE : $dictionary[$locale].EVAL_CHOICE_NO_BREATHING;
                output = [...output, resultBlock, choiceText];
                terminalState = 'AWAITING_CHOICE';
            } catch (err) {
                output = [...output, "SYSTEM CORRUPTION. DIAGNOSTIC ABORTED."];
                terminalState = 'COMMAND';
            }
            await updateScroll();
            return;
        }

        if (terminalState === 'AWAITING_SCAN') {
            output = [...output, `> ${cmd}`, "EXECUTING RE-SCAN SEQUENCE..."];
            input = '';
            await updateScroll();

            try {
                const res = await fetch('/api/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: cmd, userId: $currentUser })
                });
                const data = await res.json();

                if (typeof window !== 'undefined' && (window as any).umami) {
                    (window as any).umami.track('terminal-scan', { cc: data.cc });
                }

                const resultBlock = `CRIME COEFFICIENT: ${data.cc}\nANALYSIS: ${data.analysis}`;
                isBreathingAllowed = data.cc > 100;

                const choiceText = isBreathingAllowed ? $dictionary[$locale].EVAL_CHOICE : $dictionary[$locale].EVAL_CHOICE_NO_BREATHING;
                output = [...output, resultBlock, choiceText];
                terminalState = 'AWAITING_CHOICE';
            } catch (err) {
                output = [...output, "RE-SCAN INTERRUPTED. LINK FAULT."];
                terminalState = 'COMMAND';
            }
            await updateScroll();
            return;
        }

        if (upperCmd === 'EXIT') {
            appMode.set('INITIAL');
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'LOGIN' || upperCmd === 'REGISTER') {
            import('$app/navigation').then(nav => {
                nav.goto('/auth?from=/');
            });
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'ACCOUNT') {
            if (!$currentUser) {
                output = [...output, `> ${cmd}`, "ERROR: IDENTIFICATION REQUIRED. TYPE 'LOGIN'."];
            } else {
                import('$app/navigation').then(nav => nav.goto('/account'));
            }
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'TREND') {
            if (!$currentUser) {
                output = [...output, `> ${cmd}`, "ERROR: IDENTIFICATION REQUIRED. TYPE 'LOGIN'."];
            } else {
                import('$app/navigation').then(nav => nav.goto('/trends'));
            }
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd.startsWith('LANG')) {
            const lang = upperCmd.substring(4).trim();
            if (lang === 'EN' || lang === 'FR') {
                locale.set(lang);
                output = [...output, `> ${cmd}`, lang === 'EN' ? "LANGUAGE UPDATED TO ENGLISH." : "LANGUE MISE À JOUR EN FRANÇAIS."];
            } else {
                output = [...output, `> ${cmd}`, "INVALID LANGUAGE. SUPPORTED: EN / FR"];
            }
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'HELP') {
            output = [...output, `> ${cmd}`, $dictionary[$locale].HELP];
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'CLEAR') {
            output = [];
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'EVALUATE') {
            output = [...output, `> ${cmd}`, "MANUAL EVALUATION INITIATED.", "PLEASE DESCRIBE YOUR CURRENT EMOTIONAL STATE FOR DIAGNOSTIC EVALUATION:"];
            terminalState = 'AWAITING_TEXT';
            input = '';
            await updateScroll();
            return;
        }
        if (upperCmd === 'SCAN') {
            if (!$currentUser) {
                output = [...output, `> ${cmd}`, "ERROR: IDENTIFICATION REQUIRED. TYPE 'LOGIN'."];
            } else {
                output = [...output, `> ${cmd}`, "PERFORMING LIVE COGNITIVE PSYCHO-PASS RE-SCAN...", "ENTER RE-EVALUATION TEXT PARAMETERS TO STABILIZE INDEX:"];
                terminalState = 'AWAITING_SCAN';
            }
            input = '';
            await updateScroll();
            return;
        }

        output = [...output, `> ${cmd}`, "COMMUNICATING WITH SIBYL CORES..."];
        input = '';
        await updateScroll();

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage: cmd })
            });
            const data = await res.json();
            output = [...output, data.reply || "SIBYL STATUS STABLE."];
        } catch (err) {
            output = [...output, "CONNECTION TO CORE LINK UNAVAILABLE."];
        }
        await updateScroll();
    }

    async function updateScroll() {
        await tick();
        if (terminalWindow) {
            terminalWindow.scrollTop = terminalWindow.scrollHeight;
        }
    }
</script>

<div class="terminal-container" transition:fade>
    <div class="crt-overlay"></div>

    <div class="terminal-content" bind:this={terminalWindow}>
        {#each output as line}
            <pre class="line {line.startsWith('>') ? 'user' : 'system'}">{line}</pre>
        {/each}

        <div class="input-line">
            <span class="prompt">&gt;</span>
            <input
                    type="text"
                    bind:value={input}
                    on:keydown={handleCommand}
                    autofocus
                    spellcheck="false"
                    autocomplete="off"
            />
        </div>
    </div>
</div>

<style>
    .terminal-container {
        position: relative;
        height: 100%;
        background-color: #050505;
        color: #00ffcc;
        font-family: 'Courier New', Courier, monospace;
        padding: 20px;
        box-sizing: border-box;
        overflow: hidden;
    }

    .crt-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
        background-size: 100% 2px, 3px 100%;
        pointer-events: none;
        z-index: 10;
    }

    .terminal-content {
        position: relative;
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        z-index: 5;
        scrollbar-width: thin;
        scrollbar-color: #00ffcc #000;
        padding-bottom: 20px;
    }

    .line {
        margin: 5px 0;
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size: 1.1rem;
        text-shadow: 0 0 5px rgba(0, 255, 204, 0.5);
    }

    .line.user { color: #fff; text-shadow: none; }
    .line.system { color: #00ffcc; line-height: 1.4; }

    .input-line {
        display: flex;
        margin-top: 10px;
        font-size: 1.1rem;
    }

    .prompt { margin-right: 10px; color: #fff; }

    input {
        background: transparent;
        border: none;
        color: #fff;
        font-family: 'Courier New', Courier, monospace;
        font-size: 1.1rem;
        flex-grow: 1;
        outline: none;
        text-shadow: 0 0 5px rgba(255, 255, 255, 0.5);
    }

    @media (max-width: 768px) {
        .terminal-container {
            padding: 10px;
        }
        .line, .input-line, input {
            font-size: 0.9rem;
        }
    }
</style>