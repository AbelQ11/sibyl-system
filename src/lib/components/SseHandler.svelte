<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { goto } from '$app/navigation';
    import { globalNotificationsEnabled, latestSSEEvent } from '$lib/stores';

    export let user: any;

    let eventSource: EventSource;

    onMount(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            if (localStorage.getItem('sibyl_notifications') === 'true' && Notification.permission === 'granted') {
                globalNotificationsEnabled.set(true);
            }
        }

        if (user) {
            fetch('/api/rewards/daily', { method: 'POST' })
                .then(res => res.json())
                .then(d => {
                    if (d.success && d.reward > 0) {
                        createNotification("DAILY REWARD", d.message, null, '/shop');
                    }
                }).catch(console.error);

            eventSource = new EventSource('/api/chat/stream');
            eventSource.onmessage = (event) => {
                const eventData = JSON.parse(event.data);
                latestSSEEvent.set(eventData);

                if (eventData.type === 'message' || eventData.type === 'webrtc_signal') {
                    let isViewingDiscussion = false;
                    if (document.hasFocus() && window.location.pathname.startsWith('/chat')) {
                        const url = new URL(window.location.href);
                        if (eventData.type === 'message') {
                            if (eventData.message.targetType === 'GROUP' && url.searchParams.get('group') === String(eventData.message.groupId)) {
                                isViewingDiscussion = true;
                            } else if (eventData.message.targetType === 'PRIVATE' && url.searchParams.get('private') === String(eventData.message.senderId)) {
                                isViewingDiscussion = true;
                            } else if (eventData.message.targetType === 'PUBLIC' && !url.searchParams.get('group') && !url.searchParams.get('private')) {
                                isViewingDiscussion = true;
                            }
                        } else if (eventData.type === 'webrtc_signal') {
                            if (eventData.targetGroupId && url.searchParams.get('group') === String(eventData.targetGroupId)) {
                                isViewingDiscussion = true;
                            } else if (!eventData.targetGroupId && url.searchParams.get('private') === String(eventData.senderId)) {
                                isViewingDiscussion = true;
                            }
                        }
                    }

                    if (eventData.type === 'message') {
                        if ($globalNotificationsEnabled && eventData.message.senderId !== user.id && !isViewingDiscussion) {
                            let link = '/chat';
                            if (eventData.message.targetType === 'GROUP') {
                                link = `/chat?group=${eventData.message.groupId}`;
                            } else if (eventData.message.targetType === 'PRIVATE') {
                                link = `/chat?private=${eventData.message.senderId}`;
                            }
                            
                            createNotification(
                                "SIBYL COMMS", 
                                `${eventData.message.senderName}: ${eventData.message.isReadOnce ? '[ENCRYPTED]' : eventData.message.text}`,
                                eventData.message.senderAvatar,
                                link
                            );
                        }
                    } else if (eventData.type === 'webrtc_signal') {
                        if ($globalNotificationsEnabled && eventData.senderId !== user.id && eventData.signalType === 'join-ping' && !isViewingDiscussion) {
                            let link = eventData.targetGroupId ? `/chat?group=${eventData.targetGroupId}` : `/chat?private=${eventData.senderId}`;
                            createNotification(
                                "INCOMING TRANSMISSION", 
                                `${eventData.senderName} is initiating a secure voice call.`,
                                null,
                                link
                            );
                        }
                    }
                } else if (eventData.type === 'notification') {
                    if ($globalNotificationsEnabled && eventData.receiverId === user.id) {
                        createNotification(eventData.title || "SIBYL SYSTEM", eventData.message, null, eventData.link || null);
                    }
                }
            };

            eventSource.onerror = (error) => {
                console.error("Global SSE Error:", error);
            };
        }
    });

    function createNotification(title: string, body: string, icon?: string | null, link?: string | null) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        try {
            const options: any = { body };
            if (icon) {
                options.icon = icon.startsWith('http') || icon.startsWith('data:') 
                    ? icon 
                    : new URL(icon, window.location.origin).href;
            }
            const n = new Notification(title, options);
            n.onclick = () => {
                window.focus();
                n.close();
                if (link) {
                    goto(link);
                }
            };
        } catch (e) {
            console.error("Notification error:", e);
        }
    }

    onDestroy(() => {
        if (eventSource) eventSource.close();
    });
</script>
