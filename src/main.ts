import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';

// Offline install. The generated worker precaches the whole build; autoUpdate
// means a redeploy is fetched in the background and applied on the next load.
registerSW({ immediate: true });

const target = document.getElementById('app');
if (!target) throw new Error('index.html has no #app element');

export default mount(App, { target });
