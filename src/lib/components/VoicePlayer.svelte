<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    export let src: string;

    let audioElement: HTMLAudioElement;
    let playing = false;
    let progress = 0;
    let duration = 0;
    let currentTime = 0;

    function togglePlay() {
        if (playing) {
            audioElement.pause();
        } else {
            audioElement.play();
        }
        playing = !playing;
    }

    function handleTimeUpdate() {
        if (audioElement.duration) {
            progress = (audioElement.currentTime / audioElement.duration) * 100;
            currentTime = audioElement.currentTime;
        }
    }

    function handleLoadedMetadata() {
        duration = audioElement.duration;
    }

    function handleEnded() {
        playing = false;
        progress = 0;
        currentTime = 0;
    }

    function formatTime(seconds: number) {
        if (!seconds || isNaN(seconds)) return "00:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }

    function seek(event: MouseEvent) {
        if (!audioElement.duration) return;
        const bar = event.currentTarget as HTMLElement;
        const rect = bar.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        audioElement.currentTime = percent * audioElement.duration;
    }
</script>

<div class="voice-player">
    <audio 
        bind:this={audioElement} 
        {src} 
        on:timeupdate={handleTimeUpdate} 
        on:loadedmetadata={handleLoadedMetadata}
        on:ended={handleEnded}
        style="display: none;"
    ></audio>

    <button class="play-btn" on:click={togglePlay}>
        {playing ? '[ PAUSE ]' : '[ PLAY ]'}
    </button>
    
    <div class="progress-container" on:click={seek}>
        <div class="progress-bar" style="width: {progress}%"></div>
    </div>
    
    <div class="time-display">
        {formatTime(currentTime)} / {formatTime(duration)}
    </div>
    <div class="tag">VOICE_TRANSMISSION</div>
</div>

<style>
    .voice-player {
        display: flex;
        align-items: center;
        gap: 15px;
        background: var(--border-color, rgba(0, 255, 204, 0.05));
        border: 1px dashed var(--main-color, #00ffcc);
        padding: 10px 15px;
        margin-top: 10px;
        width: 100%;
        max-width: 400px;
    }
    
    .play-btn {
        background: transparent;
        border: 1px solid var(--main-color, #00ffcc);
        color: var(--main-color, #00ffcc);
        font-family: inherit;
        font-weight: bold;
        font-size: 0.8rem;
        cursor: pointer;
        padding: 5px 10px;
        min-width: 80px;
        transition: all 0.2s;
    }
    
    .play-btn:hover {
        background: var(--main-color, #00ffcc);
        color: #000;
        box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.5));
    }
    
    .progress-container {
        flex: 1;
        height: 6px;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3));
        cursor: pointer;
        position: relative;
    }
    
    .progress-bar {
        height: 100%;
        background: var(--main-color, #00ffcc);
        box-shadow: 0 0 8px var(--main-glow, rgba(0, 255, 204, 0.8));
        transition: width 0.1s linear;
    }

    .time-display {
        font-size: 0.75rem;
        color: var(--main-color, #00ffcc);
        min-width: 80px;
        text-align: right;
    }

    .tag {
        font-size: 0.65rem;
        color: #ffaa00;
        border: 1px solid #ffaa00;
        padding: 2px 4px;
        white-space: nowrap;
    }
</style>
