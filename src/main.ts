import { mount } from 'svelte';
import { registerSW } from 'virtual:pwa-register';
import './app.css';
import App from './App.svelte';

// Offline install. The generated worker precaches the whole build; autoUpdate
// means a redeploy is fetched in the background and applied on the next load.
registerSW({ immediate: true });

export default mount(App, { target: document.getElementById('app')! });
