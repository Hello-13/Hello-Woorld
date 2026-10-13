// Placeholder lab: replaced by the full lab for this vehicle.

import { el } from '../ui/dom.js';

export function mountHeliLab(root) {
  root.append(el('p', { class: 'lab-intro', text: 'This lab is being built.' }));
  return { update() {}, dispose() {}, api: {} };
}
