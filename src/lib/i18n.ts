import { writable } from 'svelte/store';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const locale = writable<'EN' | 'FR'>('EN');

export const dictionary = writable({
    EN: en,
    FR: fr
});