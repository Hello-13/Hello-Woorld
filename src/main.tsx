import { render } from 'preact';
import { App } from './app';
import { initSettings } from './state/settings';
import './styles/global.css';

initSettings();
render(<App />, document.getElementById('app')!);

// Installable, offline-capable app on the hosted site (production build, secure context, top-level).
// Never inside an Artifact, and never during development where it would cache stale modules.
if (!__ARTIFACT__ && import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
