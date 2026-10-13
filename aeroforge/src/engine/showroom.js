// Showroom: the product-photography stage. A procedurally built softbox studio provides crisp
// image-based reflections; a seamless graphite cyclorama sits behind the subject; a polished
// floor carries a blurred mirror reflection of the vehicle and soft contact shadows.

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
/** A dark room lit by large softboxes, pre-filtered into an environment map. */
export function showroomEnvironment(pmrem) {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(64, 32, 64), new THREE.MeshBasicMaterial({ color: 0x07080a, side: THREE.BackSide }));
  room.position.y = 14;
  s.add(room);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 64), new THREE.MeshBasicMaterial({ color: 0x121418 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  s.add(floor);
  const panel = (w, h, intensity, color, pos, rot) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    s.add(m);
  };
  panel(30, 9, 3.1, 0xffffff, [0, 28, 2], [Math.PI / 2, 0, 0]);             // overhead scrim
  panel(3.2, 18, 3.6, 0xf2f6ff, [-26, 11, 7], [0, Math.PI / 2, 0]);         // left strip
  panel(3.2, 18, 2.6, 0xf2f6ff, [26, 11, -5], [0, -Math.PI / 2, 0]);        // right strip
  panel(36, 2.4, 2.8, 0xb7cdf0, [0, 7, -30], [0, 0, 0]);                    // cool rim strip behind
  panel(22, 2.0, 0.9, 0xffe2c4, [0, 2.5, 30], [0, Math.PI, 0]);             // warm low fill in front
  const tex = pmrem.fromScene(s, 0.02).texture;
  s.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
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
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), m);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  dome.userData.fx = true;
  dome.userData.noAO = true;
  dome.raycast = () => {};
  return dome;
}

// ------------------------------------------------------------------------------- polished floor
const floorFrag = /* glsl */`
  uniform vec3 color; uniform sampler2D tDiffuse; uniform float strength; uniform float blur; uniform vec2 texel;
  uniform float fadeRadius; uniform vec3 edgeColor; uniform float pool; uniform float poolRadius;
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
    for (int i = 0; i < 12; i++) r += textureLod(tDiffuse, uv + P[i] * texel * blur, 1.5).rgb;
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
});

// ------------------------------------------------------------------------------- contact shadows
/** Soft ambient-occlusion style shadow under the subject: an orthographic depth render from the
 *  floor looking up, blurred twice, laid on the floor (the technique popularised by drei). */
class ContactShadows {
  constructor({ width = 30, depth = 30, height = 4.5, size = 512, blur = 1.5, darkness = 1.25, opacity = 0.95 } = {}) {
    this.size = size;
    this.blur = blur;
    this.group = new THREE.Group();
    this.group.rotation.x = Math.PI / 2;
    this.rt = new THREE.WebGLRenderTarget(size, size);
    this.rt.texture.generateMipmaps = false;
    this.rtBlur = new THREE.WebGLRenderTarget(size, size);
    this.rtBlur.texture.generateMipmaps = false;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({
      map: this.rt.texture, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
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
    this.blurPass(renderer, this.blur * 0.4);
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
    this.group = new THREE.Group();          // floor + contact shadow (scrolls with the ground)
    this.dome = cyclorama();
    this.dome.visible = false;
    const geo = new THREE.PlaneGeometry(120, 120);

    // mirror floor (High / Ultra) and a plain polished floor (Balanced / Performance)
    this.reflector = new Reflector(geo, {
      textureWidth: 512, textureHeight: 512, multisample: 4, color: SHOWROOM_COLORS.deck,
      shader: { name: 'ShowroomFloor', uniforms: floorUniforms(), vertexShader: floorVert, fragmentShader: floorFrag },
    });
    this.reflector.material.defines = { REFLECT: '' };
    const rt = this.reflector.getRenderTarget();
    rt.texture.generateMipmaps = true;
    rt.texture.minFilter = THREE.LinearMipmapLinearFilter;
    // reflect only during the main beauty render, never during AO / outline / shadow sub-passes
    const reflect = this.reflector.onBeforeRender;
    this.reflector.onBeforeRender = (renderer, scene, camera, ...rest) => {
      if (scene.overrideMaterial || camera !== stage.camera) return;
      reflect(renderer, scene, camera, ...rest);
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
    const r = this.stage.renderer, c = r.domElement;
    const w = Math.max(64, Math.round(c.width * this.reflectScale));
    const h = Math.max(64, Math.round(c.height * this.reflectScale));
    this.reflector.getRenderTarget().setSize(w, h);
    this.reflector.material.uniforms.texel.value.set(1 / w, 1 / h);
  }

  get visible() { return this.group.visible; }

  update(camera) {
    this.dome.position.copy(camera.position);
    camera.getWorldDirection(this.dome.material.uniforms.fwd.value);
    if (!this.group.visible || !this.contact.plane.visible) return;
    if (this.frame++ % this.contactEvery === 0) this.contact.update(this.stage.renderer, this.stage.holder);
  }
}
