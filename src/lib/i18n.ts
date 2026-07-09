import { writable } from 'svelte/store';
import en from './locales/en.json';
import fr from './locales/fr.json';

const getInitialLocale = () => {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('sibyl_locale');
        if (stored === 'EN' || stored === 'FR') return stored;
    }
    return 'EN';
};

export const locale = writable<'EN' | 'FR'>(getInitialLocale());

if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    locale.subscribe(value => {
        localStorage.setItem('sibyl_locale', value);
    });
}

export const dictionary = writable({
    EN: en,
    FR: fr
});