// Page helpers for the harness: pass as '@tools/harness/page-helpers.js' before your own steps.
// __boot(): resolves when the boot overlay has gone. __veh(): the vehicle on deck.
// __cam(px,py,pz, tx,ty,tz, fov?): place the camera, in the vehicle's own metres (its root frame).
// __hud(false): hide the hero text.
// __tile(i,j,n=3): render tile (i,j) of an n×n split of the current view, i.e. this viewport at n× the pixels
//   (3 × 1280×720 = a 3840×2160 frame, one tile at a time). __tile(): back to the whole view.
(() => {
  window.__boot = async (ms = 400000) => { const t = Date.now(); while (!document.getElementById('boot')?.hidden && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 500)); return !!document.getElementById('boot')?.hidden; };
  window.__veh = () => window.__aeroforge.app.current;
  window.__cam = (px, py, pz, tx, ty, tz, fov) => {
    const s = window.__aeroforge.stage, v = window.__veh();
    s.tween = null; s.autoQuality = false; s.controls.autoRotate = false; s.controls.minDistance = 0.01; s.controls.maxPolarAngle = Math.PI; s.controls.enableDamping = false;
    v.root.updateMatrixWorld(true);
    const V = v.root.position.constructor;
    const P = new V(px, py, pz).applyMatrix4(v.root.matrixWorld), T = new V(tx, ty, tz).applyMatrix4(v.root.matrixWorld);
    s.controls.target.copy(T); s.camera.position.copy(P);
    if (fov) { s.camera.fov = fov; s.camera.updateProjectionMatrix(); }
    s.camera.lookAt(T);
    return true;
  };
  window.__hud = (on) => { for (const e of document.querySelectorAll('.hero, .stage-shade')) e.style.visibility = on ? '' : 'hidden'; return true; };
  window.__tile = (i, j, n = 3) => {
    const s = window.__aeroforge.stage, c = s.renderer.domElement, w = c.clientWidth, h = c.clientHeight;
    if (i == null) s.camera.clearViewOffset(); else s.camera.setViewOffset(w * n, h * n, i * w, j * h, w, h);
    s.camera.updateProjectionMatrix();
    return true;
  };
  return 'helpers ready';
})()
