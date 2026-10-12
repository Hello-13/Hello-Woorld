'use strict';

const bar = document.getElementById('bar');
const title = document.getElementById('title');
const zoom = document.getElementById('zoom');
const home = document.getElementById('home');
const pin = document.querySelector('[data-act="pin"]');

function apply(s) {
  if (!s) return;
  title.textContent = s.name;
  document.title = s.name;
  zoom.textContent = s.zoom + '%';
  pin.setAttribute('aria-pressed', String(!!s.onTop));
  pin.title = s.onTop ? 'Floating above other windows. Click to let it sit normally.' : 'Float above other windows';
  home.hidden = !s.away;
  bar.classList.toggle('loading', !!s.loading);
}

window.widget.hello().then(apply);
window.widget.onState(apply);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (b) window.widget.act(b.dataset.act);
});
