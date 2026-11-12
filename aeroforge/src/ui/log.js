// Mission event log (newest first, UTC timestamps).

import { el } from './dom.js';

export class EventLog {
  constructor(list, max = 60) {
    this.list = list;
    this.max = max;
  }

  utc(d = new Date()) {
    return d.toISOString().slice(11, 19);
  }

  /** level: info | ok | warn | crit */
  push(source, message, level = 'info') {
    const li = el('li', { class: `log-row log-${level}` },
      el('time', { class: 'log-time', text: `${this.utc()}Z` }),
      el('span', { class: 'log-src', text: source }),
      el('span', { class: 'log-msg', text: message }));
    this.list.prepend(li);
    while (this.list.children.length > this.max) this.list.lastChild.remove();
  }
}
