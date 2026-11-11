// Showroom: the product-photography stage. A procedurally built softbox studio provides crisp
// image-based reflections (a big feathered key softbox the paint shows as a soft rectangle, a cool
// rim strip, a fill); a seamless graphite cyclorama with a lit horizon sits behind the subject; a
// polished floor carries a mirror reflection that blurs with the reflected part's height above the
// floor (read from the reflection's own depth), and soft, edge-masked contact shadows.

import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js';
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js';

export const SHOWROOM_COLORS = {
  top: 0x030405,      // ceiling falls to black
  wall: 0x0c1015,     // graphite cyclorama at eye level
  floor: 0x07090c,    // floor colour the far floor fades into
  glow: 0x26323f,     // soft light pool on the wall behind the subject
  deck: 0x191d23,     // polished floor base colour
};

// ------------------------------------------------------------------------------- studio IBL
/** A diffuser panel: white with feathered edges and a gentle hot spot, like a real softbox. */
function softboxTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x + 0.5) / s, v = (y + 0.5) / s;
      const fx = Math.min(1, Math.min(u, 1 - u) / 0.14), fy = Math.min(1, Math.min(v, 1 - v) / 0.14);
      const feather = fx * fx * (3 - 2 * fx) * (fy * fy * (3 - 2 * fy));
      const hot = 0.82 + 0.18 * Math.exp(-((u - 0.5) ** 2 + (v - 0.5) ** 2) * 6);
      const k = Math.round(255 * feather * hot);
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A dark room lit by large softboxes, pre-filtered into an environment map. */
export function showroomEnvironment(pmrem) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(64, 32, 64), new THREE.MeshBasicMaterial({ color: 0x06070a, side: THREE.BackSide }));
  room.position.y = 14;
  s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshBasicMaterial({ color: 0x121418 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  s.add(floor);
  const box = softboxTexture();
  const aim = new THREE.Vector3(0, 3, 0);
  const panel = (w, h, intensity, color, pos, { rot = null, feather = true } = {}) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide, map: feather ? box : null });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot); else m.lookAt(aim);
    s.add(m);
  };
  const key = new THREE.Vector3(0.42, 0.86, 0.36).normalize().multiplyScalar(24);   // the key light's direction (LOOKS.showroom.sun)
  panel(16, 11, 5.5, 0xfff6ec, [key.x, key.y, key.z]);                              // key softbox, high front-right
  panel(12, 8, 1.1, 0xf2f6ff, [-20, 9, 14]);                                        // fill, front-left
  panel(34, 1.8, 4.5, 0xb7cdf0, [0, 13, -27]);                                      // cool rim strip behind, above
  panel(3, 14, 2.2, 0xdfe8ff, [26, 10, -8]);                                        // edge light, right rear
  panel(26, 8, 1.6, 0xffffff, [0, 28, 2], { rot: [Math.PI / 2, 0, 0] });            // overhead scrim
  panel(22, 2.0, 0.8, 0xffe2c4, [0, 2.2, 30], { rot: [0, Math.PI, 0], feather: false });   // warm low fill in front
  const tex = pmrem.fromScene(s, 0.02).texture;
  s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  box.dispose();
  return tex;
}

// ------------------------------------------------------------------------------- cyclorama
function cyclorama() {
  const c = SHOWROOM_COLORS;
  const m = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(c.top) }, wall: { value: new THREE.Color(c.wall) },
      floorC: { value: new THREE.Color(c.floor) }, glow: { value: new THREE.Color(c.glow) },
      fwd: { value: new THREE.Vector3(0, 0, -1) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform vec3 top, wall, floorC, glow, fwd; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = mix(wall, top, smoothstep(0.02, 0.75, d.y));
        c = mix(floorC, c, smoothstep(-0.14, 0.03, d.y));
        // a soft pool of light on the wall behind whatever the camera looks at
        vec3 f = normalize(vec3(fwd.x, 0.0, fwd.z) + vec3(0.0, 1e-4, 0.0));
        float g = max(dot(normalize(vec3(d.x, d.y * 1.8 - 0.12, d.z)), f), 0.0);
        c += glow * pow(g, 5.0) * smoothstep(-0.08, 0.06, d.y);
        // the lit horizon of a cyclorama: where the key spills onto the curve from floor to wall
        float band = exp(-pow((d.y - 0.03) / 0.07, 2.0));
        c += wall * 0.5 * band * (0.35 + 0.65 * pow(g, 2.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 96, 48), m);   // fine enough that the interpolated direction never facets the gradient
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.fx = true;
  dome.userData.noAO = true;
  dome.raycast = () => {};
  return dome;
}

// ------------------------------------------------------------------------------- polished floor
// REFLECT: the mirror image is sampled from the Reflector's texture. DEPTHBLUR: its blur radius
// follows the reflected surface's height above the floor over its view depth, which the Reflector's
// oblique near plane (the floor) leaves directly in the depth buffer: depth = s·h / (2·w), with s the
// length of the oblique projection row (`oblique`). Without it, the fixed blur of the first version.
const floorFrag = /* glsl */`
  uniform vec3 color; uniform sampler2D tDiffuse; uniform float strength; uniform float blur; uniform vec2 texel;
  uniform float fadeRadius; uniform vec3 edgeColor; uniform float pool; uniform float poolRadius;
  uniform sampler2D tDepth; uniform float oblique; uniform float focalPx; uniform float spread; uniform float maxBlur;
  varying vec4 vUv; varying vec3 vWorld;
  const vec2 P[12] = vec2[](
    vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
    vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
    vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
  void main() {
    float d = length(vWorld.xz);
    // a soft overhead light pool, brightest under the subject
    vec3 c = color * (1.0 + pool * exp(-d * d / (poolRadius * poolRadius)));
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = 0.05 + 0.95 * pow(1.0 - clamp(V.y, 0.0, 1.0), 5.0);
  #ifdef REFLECT
    vec2 uv = vUv.xy / vUv.w;
    vec3 r = vec3(0.0);
    #ifdef DEPTHBLUR
      float hw = 2.0 * texture2D(tDepth, uv).x / max(oblique, 1e-4);     // height below the floor / view depth
      float px = clamp(spread * hw * focalPx, 0.75, maxBlur);            // blur radius, reflection texels (never a hard texel)
      float lod = max(0.0, log2(max(px, 1.0)) - 0.6);
      for (int i = 0; i < 12; i++) r += textureLod(tDiffuse, uv + P[i] * texel * px, lod).rgb;
    #else
      for (int i = 0; i < 12; i++) r += textureLod(tDiffuse, uv + P[i] * texel * blur, 1.5).rgb;
    #endif
    r /= 12.0;
    c += r * strength * mix(0.5, 1.0, fres);
  #else
    c += edgeColor * fres * 0.6;
  #endif
    c = mix(edgeColor, c, smoothstep(fadeRadius, fadeRadius * 0.28, d));
    gl_FragColor = vec4(c, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const floorVert = /* glsl */`
  uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
  void main() {
    vUv = textureMatrix * vec4(position, 1.0);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;
const floorUniforms = () => ({
  color: { value: new THREE.Color(SHOWROOM_COLORS.deck) },
  tDiffuse: { value: null },
  textureMatrix: { value: new THREE.Matrix4() },
  strength: { value: 0.62 },
  blur: { value: 2.2 },
  texel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
  fadeRadius: { value: 46 },
  edgeColor: { value: new THREE.Color(SHOWROOM_COLORS.floor) },
  pool: { value: 3.2 },
  poolRadius: { value: 10 },
  tDepth: { value: null },
  oblique: { value: 1 },
  focalPx: { value: 900 },
  spread: { value: 0.085 },     // tangent of the floor's gloss lobe: a polished, not mirror, deck
  maxBlur: { value: 40 },
});

// ------------------------------------------------------------------------------- contact shadows
/** Soft edge mask so the blurred shadow texture never shows the bounds of its plane. */
function edgeMask() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = (x + 0.5) / s, v = (y + 0.5) / s;
      const fx = Math.min(1, Math.min(u, 1 - u) / 0.2), fy = Math.min(1, Math.min(v, 1 - v) / 0.2);
      const k = Math.round(255 * (fx * fx * (3 - 2 * fx)) * (fy * fy * (3 - 2 * fy)));
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = k; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

/** Soft ambient-occlusion style shadow under the subject: an orthographic depth render from the
 *  floor looking up, blurred twice, laid on the floor (the technique popularised by drei). */
class ContactShadows {
  constructor({ width = 30, depth = 30, height = 4.5, size = 512, blur = 1.2, darkness = 1.2, opacity = 0.9 } = {}) {
    this.size = size;
    this.blur = blur;
    this.group = new THREE.Group();
    this.group.rotation.x = Math.PI / 2;
    this.rt = new THREE.WebGLRenderTarget(size, size);
    this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(size, size);
    this.rtBlur.texture.generateMipmaps = false;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({
      map: this.rt.texture, alphaMap: edgeMask(), transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    }));
    plane.scale.y = -1;
    plane.renderOrder = 1;
    plane.userData.fx = true;
    plane.userData.noAO = true;
    plane.raycast = () => {};
    this.plane = plane;
    this.camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0, height);
    this.group.add(plane, this.camera);
    this.depthMat = new THREE.MeshDepthMaterial();      // nearest surface (darkest) wins
    this.depthMat.onBeforeCompile = (shader) => {
      shader.uniforms.darkness = { value: darkness };
      shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace(
        'gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );',
        'gl_FragColor = vec4( vec3( 0.0 ), clamp( pow( 1.0 - fragCoordZ, 0.55 ) * darkness, 0.0, 1.0 ) );',
      )}`;
    };
    this.hBlur = new THREE.ShaderMaterial(HorizontalBlurShader);
    this.vBlur = new THREE.ShaderMaterial(VerticalBlurShader);
    this.hBlur.depthTest = this.vBlur.depthTest = false;
    this.quad = new FullScreenQuad();
    this.scene = new THREE.Scene();
    this.scene.overrideMaterial = this.depthMat;
    this._hidden = [];
  }

  setSize(size) {
    if (size === this.size) return;
    this.size = size;
    this.rt.setSize(size, size);
    this.rtBlur.setSize(size, size);
  }

  blurPass(renderer, amount) {
    this.quad.material = this.hBlur;
    this.hBlur.uniforms.tDiffuse.value = this.rt.texture;
    this.hBlur.uniforms.h.value = amount / 256;
    renderer.setRenderTarget(this.rtBlur);
    this.quad.render(renderer);
    this.quad.material = this.vBlur;
    this.vBlur.uniforms.tDiffuse.value = this.rtBlur.texture;
    this.vBlur.uniforms.v.value = amount / 256;
    renderer.setRenderTarget(this.rt);
    this.quad.render(renderer);
  }

  /** Re-render the shadow of `subject` (temporarily moved into a private scene). */
  update(renderer, subject) {
    const parent = subject.parent;
    if (!parent) return;
    // effects (plumes, arrows, labels, points) cast no contact shadow
    const hidden = this._hidden;
    hidden.length = 0;
    subject.traverse((o) => {
      if (o.visible && (o.userData.fx || o.isPoints || o.isLine || o.isSprite)) { o.visible = false; hidden.push(o); }
    });
    this.camera.updateWorldMatrix(true, false);
    this.scene.add(subject);
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearAlpha();
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    this.blurPass(renderer, this.blur);
    this.blurPass(renderer, this.blur * 0.35);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevClear);
    renderer.shadowMap.autoUpdate = prevShadow;
    parent.add(subject);
    for (const o of hidden) o.visible = true;
  }

  dispose() {
    this.rt.dispose(); this.rtBlur.dispose(); this.depthMat.dispose(); this.hBlur.dispose(); this.vBlur.dispose(); this.quad.dispose();
  }
}

// ------------------------------------------------------------------------------- assembly
export class Showroom {
  /** stage: provides renderer, camera and the subject holder. */
  constructor(stage) {
    this.stage = stage;
    this.depthBlur = stage.fx?.studio !== false;      // ?studio=classic keeps the fixed-blur floor
    this.group = new THREE.Group();          // floor + contact shadow (scrolls with the ground)
    this.dome = cyclorama();
    this.dome.visible = false;
    const geo = new THREE.PlaneGeometry(120, 120);

    // mirror floor (High / Ultra) and a plain polished floor (Balanced / Performance)
    this.reflector = new Reflector(geo, {
      textureWidth: 512, textureHeight: 512, multisample: 0, color: SHOWROOM_COLORS.deck,   // blurred: MSAA would be wasted
      shader: { name: 'ShowroomFloor', uniforms: floorUniforms(), vertexShader: floorVert, fragmentShader: floorFrag },
    });
    this.reflector.material.defines = this.depthBlur ? { REFLECT: '', DEPTHBLUR: '' } : { REFLECT: '' };
    const rt = this.reflector.getRenderTarget();
    if (this.depthBlur) {
      rt.depthTexture = new THREE.DepthTexture(512, 512);     // the renderer resizes it with the target
      this.reflector.material.uniforms.tDepth.value = rt.depthTexture;
      // The floor reads a mip chain of the reflection, and one NaN / Inf pixel in it (a part's
      // shader under the mirrored camera) poisons every coarser mip over it into an aligned black
      // block. So the mirror image is copied once through a NaN guard into the texture the floor
      // samples, and mipmaps are built from that copy.
      rt.texture.generateMipmaps = false;
      this.clean = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      this.cleanMat = new THREE.ShaderMaterial({
        uniforms: { tDiffuse: { value: rt.texture } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */`
          uniform sampler2D tDiffuse; varying vec2 vUv;
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            bool ok = all(lessThan(abs(c), vec4(60000.0))) && !any(isnan(c)) && !any(isinf(c));
            gl_FragColor = ok ? c : vec4(0.0, 0.0, 0.0, 1.0);
          }`,
        depthTest: false, depthWrite: false,
      });
      this.cleanQuad = new FullScreenQuad(this.cleanMat);
      this.reflector.material.uniforms.tDiffuse.value = this.clean.texture;
    } else {
      rt.texture.generateMipmaps = true;
      rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    }
    // reflect only during the main beauty render, never during AO / outline / shadow sub-passes;
    // at high frame rates every other frame (the blurred image lags ~4 ms, which nobody can see)
    const reflect = this.reflector.onBeforeRender;
    this.reflector.onBeforeRender = (renderer, scene, camera, ...rest) => {
      if (scene.overrideMaterial || camera !== stage.camera) return;
      if (stage.highRate && this.reflected && (stage.frameNo & 1)) return;
      this.reflected = true;
      reflect(renderer, scene, camera, ...rest);
      if (this.depthBlur) {
        // the oblique row's scale: depth = s · (height below the floor) / (2 · view depth)
        const e = this.reflector.camera.projectionMatrix.elements;
        this.reflector.material.uniforms.oblique.value = Math.hypot(e[2], e[6], e[10] - 1) || 1;
        const prev = renderer.getRenderTarget();
        renderer.setRenderTarget(this.clean);
        this.cleanQuad.render(renderer);
        renderer.setRenderTarget(prev);
      }
    };
    this.plain = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: floorUniforms(), vertexShader: floorVert, fragmentShader: floorFrag,
    }));
    for (const f of [this.reflector, this.plain]) {
      f.rotation.x = -Math.PI / 2;
      f.position.y = -0.002;
      f.userData.fx = true;
      f.raycast = () => {};
    }
    this.contact = new ContactShadows();
    this.contact.group.position.y = 0.004;
    this.group.add(this.reflector, this.plain, this.contact.group);
    this.reflectScale = 0;
    this.contactEvery = 1;
    this.frame = 0;
    this._sweeping = false;
    this.setQuality({ reflect: 0.5, contact: 1024 });
  }

  setQuality({ reflect = 0, contact = 512, contactEvery = 1 }) {
    this.reflectScale = reflect;
    this.reflector.visible = reflect > 0;
    this.plain.visible = reflect <= 0;
    this.contact.setSize(contact);
    this.contact.plane.visible = contact > 0;
    this.contactEvery = contactEvery;
    this.resize();
  }

  resize() {
    if (!this.reflectScale) return;
    const c = this.stage.renderer.domElement;
    // the floor blurs most of its reflection, so past ~2.4 MP (1.2 MP with the fixed blur) extra
    // resolution is invisible; the contact zone is sharp, so the depth-blurred floor gets the higher cap
    const k = Math.min(this.reflectScale, Math.sqrt((this.depthBlur ? 2.4e6 : 1.2e6) / Math.max(1, c.width * c.height)));
    const w = Math.max(64, Math.round(c.width * k));
    const h = Math.max(64, Math.round(c.height * k));
    this.reflected = false;
    this.reflector.getRenderTarget().setSize(w, h);
    this.clean?.setSize(w, h);
    const u = this.reflector.material.uniforms;
    u.texel.value.set(1 / w, 1 / h);
    u.focalPx.value = h / (2 * Math.tan((this.stage.camera.fov * Math.PI) / 360));   // pixel focal length of the reflection
  }

  get visible() { return this.group.visible; }

  /** Film mode's light sweep: the softbox rig and the key light turn slowly about the subject
   *  (±29° over ~70 s), so highlights travel across the paint. Only in the showroom look; off
   *  restores the look's lighting exactly. */
  sweep(on, t = 0) {
    const env = this.stage.env;
    if (!env?.lights) return;
    const active = on && env.look === 'showroom' && !env.overlay && !env.space;
    const key = env.lights.key;
    if (!active) {
      if (!this._sweeping) return;
      this._sweeping = false;
      env.scene.environmentRotation.set(0, 0, 0);
      key.position.copy(env.sunDir).multiplyScalar(40);
      return;
    }
    this._sweeping = true;
    const a = Math.sin(t * 0.09) * 0.5;
    env.scene.environmentRotation.set(0, a, 0);
    key.position.copy(env.sunDir).applyAxisAngle(this._up || (this._up = new THREE.Vector3(0, 1, 0)), a).multiplyScalar(40);
  }

  update(camera) {
    this.dome.position.copy(camera.position);
    camera.getWorldDirection(this.dome.material.uniforms.fwd.value);
    if (!this.group.visible || !this.contact.plane.visible) return;
    const every = this.contactEvery * (this.stage.highRate ? 2 : 1);
    if (this.frame++ % every === 0) this.contact.update(this.stage.renderer, this.stage.holder);
  }
}
