<script lang="ts">
    import { fade, slide } from 'svelte/transition';
    import { locale, dictionary } from '$lib/i18n';
    import { currentUser } from '$lib/stores';

    export let data;

    let posts = data.posts || [];
    let cc = data.cc || 0;
    
    let newPostContent = '';
    let isSubmitting = false;
    let errorMessage = '';
    
    let fileInput: HTMLInputElement;
    let attachmentBase64: string | null = null;

    let activeCommentPostId: number | null = null;
    let comments: Record<number, any[]> = {};
    let newCommentContent = '';
    let isSubmittingComment = false;
    let commentErrorMessage = '';

    const isAdmin = data.user?.role === 'ADMIN';
    const isLethal = !isAdmin && cc > 300;
    const isParalyzer = !isAdmin && (cc >= 100 && cc <= 300);

    async function submitPost() {
        if (!newPostContent.trim() || isSubmitting || isLethal) return;

        isSubmitting = true;
        errorMessage = '';

        try {
            const res = await fetch('/api/posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newPostContent, image_url: attachmentBase64 })
            });

            if (res.ok) {
                const newPost = await res.json();
                posts = [newPost, ...posts];
                newPostContent = '';
                attachmentBase64 = null;
            } else {
                const errData = await res.json();
                errorMessage = errData.error || 'Failed to submit broadcast.';
            }
        } catch (e) {
            errorMessage = 'Network anomaly detected. Broadcast failed.';
        } finally {
            isSubmitting = false;
        }
    }

    async function toggleLike(post: any) {
        try {
            const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                post.isLikedByMe = data.isLikedByMe;
                post.likeCount = data.likeCount;
                posts = posts; // trigger reactivity
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function deletePost(postId: number) {
        if (!confirm("Are you sure you want to delete this post?")) return;
        try {
            const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
            if (res.ok) {
                posts = posts.filter((p: any) => p.id !== postId);
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function censorPost(post: any) {
        if (!confirm("Are you sure you want to censor this post?")) return;
        try {
            const res = await fetch(`/api/posts/${post.id}/censor`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                post.content = data.redactedText;
                post.is_censored = 1;
                posts = posts;
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function toggleComments(post: any) {
        if (activeCommentPostId === post.id) {
            activeCommentPostId = null;
            return;
        }
        
        activeCommentPostId = post.id;
        newCommentContent = '';
        commentErrorMessage = '';

        if (!comments[post.id]) {
            try {
                const res = await fetch(`/api/posts/${post.id}/comments`);
                if (res.ok) {
                    comments[post.id] = await res.json();
                }
            } catch (e) {
                console.error(e);
            }
        }
    }

    async function submitComment(postId: number) {
        if (!newCommentContent.trim() || isSubmittingComment || isLethal) return;

        isSubmittingComment = true;
        commentErrorMessage = '';

        try {
            const res = await fetch(`/api/posts/${postId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: newCommentContent })
            });

            if (res.ok) {
                const newComment = await res.json();
                comments[postId] = [...(comments[postId] || []), newComment];
                
                const post = posts.find((p: any) => p.id === postId);
                if (post) post.commentCount = (post.commentCount || 0) + 1;
                posts = posts;
                
                newCommentContent = '';
            } else {
                const errData = await res.json();
                commentErrorMessage = errData.error || 'Failed to submit comment.';
            }
        } catch (e) {
            commentErrorMessage = 'Network anomaly detected.';
        } finally {
            isSubmittingComment = false;
        }
    }

    async function deleteComment(postId: number, commentId: number) {
        if (!confirm("Are you sure you want to delete this comment?")) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
            if (res.ok) {
                comments[postId] = comments[postId].filter((c: any) => c.id !== commentId);
                const post = posts.find((p: any) => p.id === postId);
                if (post) post.commentCount = Math.max(0, (post.commentCount || 0) - 1);
                posts = posts;
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function censorComment(postId: number, comment: any) {
        if (!confirm("Are you sure you want to censor this comment?")) return;
        try {
            const res = await fetch(`/api/posts/${postId}/comments/${comment.id}/censor`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                comment.content = data.redactedText;
                comment.is_censored = 1;
                comments[postId] = comments[postId];
            }
        } catch (e) {
            console.error(e);
        }
    }

    function formatDate(dateStr: string) {
        /** Ensure sqlite dates (e.g. "2026-07-21 07:58:26") are parsed as UTC by replacing space with T and appending Z */
        const safeDateStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
        const d = new Date(safeDateStr);
        return d.toLocaleString($locale === 'FR' ? 'fr-FR' : 'en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function handleFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;
        const file = input.files[0];
        
        if (file.size > 5000000) {
            alert($dictionary[$locale].CHAT_ERR_IMG_SIZE || 'Transmission failed: Image exceeds 4MB limit.');
            fileInput.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            attachmentBase64 = ev.target?.result as string;
            errorMessage = '';
        };
        reader.readAsDataURL(file);
    }

    function removeAttachment() {
        attachmentBase64 = null;
        if (fileInput) fileInput.value = '';
    }
</script>

<svelte:head>
    <title>SIBYL SYSTEM - {$dictionary[$locale].NAV_FEED || 'Public Feed'}</title>
</svelte:head>

<div class="feed-container" transition:fade>
    <div class="feed-header">
        <h1 class="glitch-text" data-text="PUBLIC_BROADCAST_NETWORK">PUBLIC_BROADCAST_NETWORK</h1>
        <div class="cc-status" class:lethal={isLethal} class:warning={isParalyzer}>
            CURRENT_CC: {cc.toFixed(1)}
        </div>
    </div>

    <div class="composer-box">
        {#if isLethal}
            <div class="enforcement-warning" transition:fade>
                <div class="warning-icon">⚠</div>
                <div class="warning-text">
                    ENFORCEMENT ACTION REQUIRED. POSTING PRIVILEGES REVOKED.
                </div>
            </div>
        {:else}
            <textarea 
                bind:value={newPostContent} 
                placeholder={$dictionary[$locale].FEED_PLACEHOLDER || "Broadcast a thought to the network..."}
                maxlength="500"
                disabled={isSubmitting}
            ></textarea>
            
            <div class="composer-actions">
                <div class="input-controls">
                    <input 
                        type="file" 
                        accept="image/*" 
                        bind:this={fileInput} 
                        on:change={handleFileChange} 
                        style="display: none;" 
                    />
                    <button class="action-btn attach-btn" on:click={() => fileInput.click()} disabled={isSubmitting}>
                        [ IMG ]
                    </button>
                    <span class="char-count" class:near-limit={newPostContent.length > 450}>
                        {newPostContent.length}/500
                    </span>
                </div>
                
                {#if errorMessage}
                    <span class="error-msg" transition:slide>{errorMessage}</span>
                {/if}

                <button class="submit-btn" on:click={submitPost} disabled={(!newPostContent.trim() && !attachmentBase64) || isSubmitting}>
                    {isSubmitting ? 'TRANSMITTING...' : 'TRANSMIT'}
                </button>
            </div>
            
            {#if attachmentBase64}
                <div class="attachment-preview" transition:slide>
                    <img src={attachmentBase64} alt="Attachment preview" />
                    <button class="cancel-btn" on:click={removeAttachment}>X</button>
                </div>
            {/if}

            {#if isParalyzer}
                <div class="filter-warning">
                    * SIBYL filter active. Stress-inducing speech will be redacted.
                </div>
            {/if}
        {/if}
    </div>

    <div class="timeline">
        {#if posts.length === 0}
            <div class="no-posts">
                >>> NETWORK_SILENCE_DETECTED
            </div>
        {/if}

        {#each posts as post (post.id)}
            <div class="post-card" class:admin-post={post.role === 'ADMIN'} transition:slide>
                <div class="post-avatar">
                    {#if post.avatar}
                        <img src={post.avatar} alt="Avatar" />
                    {:else}
                        <div class="blank-avatar"></div>
                    {/if}
                </div>
                
                <div class="post-body">
                    <div class="post-meta">
                        <span class="post-username" class:blurred={post.role === 'ADMIN'}>{post.username}</span>
                        <span class="post-id">{post.citizen_id}</span>
                        <span class="post-date">{formatDate(post.created_at)}</span>
                    </div>
                    
                    <div class="post-content" class:censored={post.is_censored}>
                        {post.content}
                    </div>

                    {#if post.image_url}
                        <img src={post.image_url} alt="Post attachment" class="post-attachment-img" />
                    {/if}

                    <div class="post-actions">
                        <button class="action-btn" class:liked={post.isLikedByMe} on:click={() => toggleLike(post)}>
                            {post.isLikedByMe ? '♥' : '♡'} {post.likeCount || 0}
                        </button>
                        <button class="action-btn" on:click={() => toggleComments(post)}>
                            {$dictionary[$locale].FEED_BTN_COMMENT || '[ COMMENT ]'} ({post.commentCount || 0})
                        </button>
                        {#if data?.user?.role === 'ADMIN'}
                            <button class="action-btn" style="color: #ffaa00;" on:click={() => censorPost(post)}>[ CENSOR ]</button>
                            <button class="action-btn" style="color: #ff3333;" on:click={() => deletePost(post.id)}>[ DELETE ]</button>
                        {/if}
                    </div>

                    {#if activeCommentPostId === post.id}
                        <div class="comments-section" transition:slide>
                            <div class="comments-list">
                                {#if comments[post.id] && comments[post.id].length > 0}
                                    {#each comments[post.id] as comment}
                                        <div class="comment-item">
                                            <div class="comment-meta">
                                                <span class="comment-username">{comment.username}</span>
                                                <span class="comment-id">{comment.citizen_id}</span>
                                            </div>
                                            <div class="comment-content" class:censored={comment.is_censored}>
                                                {comment.content}
                                            </div>
                                            {#if data?.user?.role === 'ADMIN'}
                                                <div class="comment-actions">
                                                    <button class="action-btn" style="color: #ffaa00;" on:click={() => censorComment(post.id, comment)}>CENSOR</button>
                                                    <button class="action-btn" style="color: #ff3333;" on:click={() => deleteComment(post.id, comment.id)}>DELETE</button>
                                                </div>
                                            {/if}
                                        </div>
                                    {/each}
                                {:else if comments[post.id]}
                                    <div class="no-comments">{$dictionary[$locale].FEED_NO_COMMENTS || 'No comments yet.'}</div>
                                {:else}
                                    <div class="no-comments">LOADING...</div>
                                {/if}
                            </div>
                            
                            {#if isLethal}
                                <div class="filter-warning">COMMENTING PRIVILEGES REVOKED.</div>
                            {:else}
                                <div class="comment-composer">
                                    <input 
                                        type="text" 
                                        bind:value={newCommentContent} 
                                        placeholder="Add a comment..." 
                                        disabled={isSubmittingComment}
                                        maxlength="500"
                                        on:keydown={(e) => e.key === 'Enter' && submitComment(post.id)}
                                    />
                                    <button on:click={() => submitComment(post.id)} disabled={!newCommentContent.trim() || isSubmittingComment}>
                                        {isSubmittingComment ? '...' : '>'}
                                    </button>
                                </div>
                                {#if commentErrorMessage}
                                    <div class="error-msg">{commentErrorMessage}</div>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>

<style>
    .feed-container {
        width: 100%;
        max-width: 700px;
        margin: 0 auto;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 20px;
        box-sizing: border-box;
        font-family: 'Courier New', Courier, monospace;
        color: var(--main-color, #00ffcc);
        overflow-y: auto;
    }

    .feed-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        border-bottom: 2px solid var(--border-color, rgba(0, 255, 204, 0.4));
        padding-bottom: 10px;
        margin-bottom: 20px;
    }

    .glitch-text {
        font-size: 1.5rem;
        margin: 0;
        letter-spacing: 2px;
        text-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.6));
    }

    .cc-status {
        font-size: 0.9rem;
        padding: 4px 8px;
        border: 1px solid var(--main-color, #00ffcc);
        background: rgba(0, 255, 204, 0.1);
    }

    .cc-status.warning {
        border-color: #ff9900;
        color: #ff9900;
        background: rgba(255, 153, 0, 0.1);
    }

    .cc-status.lethal {
        border-color: #ff3333;
        color: #ff3333;
        background: rgba(255, 51, 51, 0.1);
        animation: pulse-lethal 1.5s infinite;
    }

    @keyframes pulse-lethal {
        0%, 100% { box-shadow: 0 0 5px rgba(255, 51, 51, 0.5); }
        50% { box-shadow: 0 0 15px rgba(255, 51, 51, 0.8); }
    }

    .composer-box {
        background: rgba(0, 0, 0, 0.6);
        border: 1px solid var(--border-color, rgba(0, 255, 204, 0.3));
        padding: 15px;
        margin-bottom: 30px;
        box-shadow: inset 0 0 10px rgba(0, 255, 204, 0.05);
    }

    .composer-box textarea {
        width: 100%;
        background: rgba(0, 255, 204, 0.03);
        border: 1px dashed var(--border-color, rgba(0, 255, 204, 0.4));
        color: var(--main-color, #00ffcc);
        font-family: inherit;
        font-size: 1rem;
        padding: 10px;
        box-sizing: border-box;
        resize: vertical;
        min-height: 80px;
        outline: none;
    }

    .composer-box textarea:focus {
        border-style: solid;
        box-shadow: 0 0 8px var(--main-glow, rgba(0, 255, 204, 0.3));
    }

    .composer-actions {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 10px;
    }

    .char-count {
        font-size: 0.8rem;
        opacity: 0.7;
    }

    .char-count.near-limit {
        color: #ff9900;
        font-weight: bold;
    }

    .error-msg {
        color: #ff3333;
        font-size: 0.85rem;
        text-shadow: 0 0 5px #ff3333;
    }

    .submit-btn {
        background: transparent;
        border: 1px solid var(--main-color, #00ffcc);
        color: var(--main-color, #00ffcc);
        padding: 5px 15px;
        font-family: inherit;
        cursor: pointer;
        transition: all 0.2s;
    }

    .submit-btn:hover:not(:disabled) {
        background: rgba(0, 255, 204, 0.1);
        box-shadow: 0 0 10px var(--main-glow, rgba(0, 255, 204, 0.5));
    }

    .submit-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .filter-warning {
        font-size: 0.75rem;
        color: #ff9900;
        margin-top: 10px;
        opacity: 0.8;
    }

    .enforcement-warning {
        display: flex;
        align-items: center;
        gap: 15px;
        padding: 20px;
        background: rgba(255, 51, 51, 0.1);
        border: 1px dashed #ff3333;
        color: #ff3333;
    }

    .warning-icon {
        font-size: 2rem;
        animation: blink 1s steps(2, start) infinite;
    }

    .warning-text {
        font-weight: bold;
        letter-spacing: 1px;
    }

    @keyframes blink {
        to { visibility: hidden; }
    }

    .timeline {
        display: flex;
        flex-direction: column;
        gap: 15px;
    }

    .post-card {
        display: flex;
        gap: 15px;
        padding: 15px;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid var(--border-color, rgba(0, 255, 204, 0.15));
        transition: border-color 0.3s;
    }

    .post-card.admin-post {
        border: 1px solid #ff3333;
        box-shadow: inset 0 0 10px rgba(255, 51, 51, 0.1);
    }

    .post-card:hover {
        border-color: var(--main-color, #00ffcc);
    }

    .post-avatar {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border: 1px solid var(--main-color, #00ffcc);
        background: rgba(0, 255, 204, 0.1);
    }

    .post-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .blank-avatar {
        width: 100%;
        height: 100%;
        opacity: 0.2;
    }

    .post-body {
        flex-grow: 1;
        min-width: 0;
    }

    .post-meta {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin-bottom: 8px;
        flex-wrap: wrap;
    }

    .post-username {
        font-weight: bold;
        font-size: 1.1rem;
        text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.3));
    }

    .blurred {
        filter: blur(4px);
        user-select: none;
    }

    .post-id {
        font-size: 0.8rem;
        opacity: 0.6;
    }

    .post-date {
        font-size: 0.75rem;
        opacity: 0.4;
        margin-left: auto;
    }

    .post-content {
        font-size: 0.95rem;
        line-height: 1.4;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .post-content.censored {
        text-shadow: 0 0 2px rgba(255, 255, 255, 0.3);
    }

    .no-posts {
        text-align: center;
        padding: 40px;
        opacity: 0.5;
        font-style: italic;
    }

    .post-actions {
        display: flex;
        gap: 15px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px dashed var(--border-color, rgba(0, 255, 204, 0.2));
    }

    .action-btn {
        background: transparent;
        border: none;
        color: var(--main-color, #00ffcc);
        font-family: inherit;
        font-size: 0.85rem;
        cursor: pointer;
        opacity: 0.7;
        transition: all 0.2s;
        padding: 0;
    }

    .action-btn:hover {
        opacity: 1;
        text-shadow: 0 0 5px var(--main-glow, rgba(0, 255, 204, 0.5));
    }

    .action-btn.liked {
        color: #ff3366;
        opacity: 1;
        text-shadow: 0 0 5px rgba(255, 51, 102, 0.5);
    }

    .comments-section {
        margin-top: 15px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--border-color, rgba(0, 255, 204, 0.1));
    }

    .comments-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 10px;
    }

    .comment-item {
        padding: 8px;
        border-left: 2px solid var(--main-color, #00ffcc);
        background: rgba(0, 255, 204, 0.05);
    }

    .comment-meta {
        display: flex;
        gap: 10px;
        font-size: 0.8rem;
        margin-bottom: 4px;
    }

    .comment-username {
        font-weight: bold;
    }

    .comment-id {
        opacity: 0.6;
    }

    .comment-content {
        font-size: 0.85rem;
        line-height: 1.3;
    }

    .comment-content.censored {
        text-shadow: 0 0 2px rgba(255, 255, 255, 0.3);
    }

    .comment-actions {
        display: flex;
        gap: 10px;
        margin-top: 5px;
        font-size: 0.75rem;
    }

    .no-comments {
        font-size: 0.8rem;
        opacity: 0.5;
        font-style: italic;
    }

    .comment-composer {
        display: flex;
        gap: 10px;
    }

    .comment-composer input {
        flex-grow: 1;
        background: rgba(0, 255, 204, 0.05);
        border: 1px solid var(--border-color, rgba(0, 255, 204, 0.3));
        color: var(--main-color, #00ffcc);
        font-family: inherit;
        padding: 5px 8px;
        outline: none;
    }

    .comment-composer input:focus {
        border-color: var(--main-color, #00ffcc);
    }

    .comment-composer button {
        background: transparent;
        border: 1px solid var(--main-color, #00ffcc);
        color: var(--main-color, #00ffcc);
        padding: 0 10px;
        cursor: pointer;
    }

    .comment-composer button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .input-controls {
        display: flex;
        gap: 15px;
        align-items: center;
    }

    .attach-btn {
        border: 1px solid var(--main-color, #00ffcc);
        padding: 4px 10px;
        height: auto;
    }
    
    .attachment-preview {
        position: relative;
        display: inline-block;
        margin-top: 10px;
        border: 1px solid var(--main-color, #00ffcc);
    }
    
    .attachment-preview img {
        max-height: 100px;
        display: block;
    }
    
    .attachment-preview .cancel-btn {
        position: absolute;
        top: 0;
        right: 0;
        background: rgba(0,0,0,0.8);
        padding: 2px 5px;
        border: none;
        color: #ff3333;
        cursor: pointer;
    }

    .post-attachment-img {
        max-width: 100%;
        max-height: 400px;
        margin-top: 15px;
        border: 1px solid var(--main-glow, rgba(0, 255, 204, 0.3));
        border-radius: 4px;
        display: block;
    }
</style>
