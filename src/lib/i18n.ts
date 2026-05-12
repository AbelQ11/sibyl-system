import { writable } from 'svelte/store';
import dict from './dictionary.json';

export const locale = writable<'EN' | 'FR'>('EN');

export const dictionary = writable(dict);