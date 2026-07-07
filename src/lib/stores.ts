import { writable } from 'svelte/store';

export const appMode = writable<'TERMINAL' | 'BREATHING' | 'TREND_VIEW' | 'INITIAL' | 'SCANNING' | 'RESULTS'>('INITIAL');

export const crimeCoefficient = writable<number>(0);
export const isScanning = writable<boolean>(false);
export const terminalAutoTrigger = writable<string | null>(null);
export const currentUser = writable<string | null>(null);
export const userAvatar = writable<string | null>(null);
export const autoStartScan = writable<boolean>(false);

export const globalNotificationsEnabled = writable<boolean>(false);
export const latestSSEEvent = writable<any>(null);