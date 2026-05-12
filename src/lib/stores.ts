import { writable } from 'svelte/store';

export type AppMode = 'INITIAL' | 'TERMINAL' | 'SCANNING' | 'BREATHING' | 'TREND_VIEW';

export const appMode = writable<AppMode>('INITIAL');
export const crimeCoefficient = writable<number>(0);
export const isScanning = writable<boolean>(false);
export const terminalAutoTrigger = writable<string | null>(null);
export const currentUser = writable<{ id: string; username: string } | null>(null);