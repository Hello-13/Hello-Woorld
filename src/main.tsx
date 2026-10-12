import { render } from 'preact';
import { App } from './app';
import { initSettings } from './state/settings';
import './styles/global.css';

initSettings();
render(<App />, document.getElementById('app')!);
