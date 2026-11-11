// Projected decals (markings, stencils, insignia) painted on canvas and wrapped onto meshes
// with DecalGeometry, so they follow the real curvature of the skin.

import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { decalTexture, decalSdf, crispOn } from './surface.js';

// Sharp decal edges. A decal's map carries its ink as filtered coverage, which is right when the texture is
// minified (the mip chain averages it) but goes soft once a texel covers several pixels. Its distance field
// (surface.js, decalSdf) stays sharp at any magnification: the edge is rebuilt from the field, one pixel wide,
// and takes over from the map's own alpha as the decal's texels grow past a pixel.
const CRISP_DECAL_PARS = /* glsl */`
uniform sampler2D crispSdf;
uniform vec2 crispSdfSize;
uniform float crispInk;
`;
const CRISP_DECAL_MAP = /* glsl */`
#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	{
		vec2 crispT = vMapUv * crispSdfSize;
		float crispTpp = max( length( dFdx( crispT ) ), length( dFdy( crispT ) ) );      // decal texels per screen pixel
		float crispD = texture2D( crispSdf, vMapUv ).r;
		float crispG = max( length( vec2( dFdx( crispD ), dFdy( crispD ) ) ), 1e-5 );   // field change per pixel
		float crispA = clamp( ( crispD - 0.5 ) / crispG + 0.5, 0.0, 1.0 ) * crispInk;
		sampledDiffuseColor.a = mix( crispA, sampledDiffuseColor.a, smoothstep( 0.6, 1.2, crispTpp ) );
	}
	diffuseColor *= sampledDiffuseColor;
#endif
`;

/**
 * Give a decal / stencil material (a lit built-in material whose map came from decalTexture) the
 * distance-field edge. No-op when the map has no field or the crisp switch is off (FX.crisp, ?crisp=0).
 */
export function crispDecal(material) {
  const f = crispOn() ? decalSdf(material.map) : null;
  if (!f) return material;
  const size = new THREE.Vector2(f.width, f.height);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.crispSdf = { value: f.sdf };
    shader.uniforms.crispSdfSize = { value: size };
    shader.uniforms.crispInk = { value: f.ink };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', '#include <map_pars_fragment>\n' + CRISP_DECAL_PARS)
      .replace('#include <map_fragment>', CRISP_DECAL_MAP);
  };
  material.customProgramCacheKey = () => 'crisp-decal';
  return material;
}

/**
 * Project a decal onto `target` (world matrices must be current). The decal mesh is returned
 * in the target's root space; add it to the part group that owns the target.
 * at: [x,y,z] point on the surface; dir: [x,y,z] direction the decal faces (outward normal);
 * size: [w,h,depth] in metres; angle: rotation about the normal (rad).
 */
export function decal(target, texture, { at, dir, size, angle = 0, color = 0xffffff, opacity = 1, roughness = 0.6, metalness = 0.1, emissive = 0, into = null }) {
  target.updateMatrixWorld(true);
  const p = new THREE.Vector3(...at);
  const n = new THREE.Vector3(...dir).normalize();
  const m = new THREE.Matrix4().lookAt(p.clone().add(n), p, Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0));
  const e = new THREE.Euler().setFromRotationMatrix(m);
  const q = new THREE.Quaternion().setFromEuler(e).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle));
  e.setFromQuaternion(q);
  const g = new DecalGeometry(target, p, e, new THREE.Vector3(...size));
  if (into) { into.updateMatrixWorld(true); g.applyMatrix4(into.matrixWorld.clone().invert()); }
  const mat = crispDecal(new THREE.MeshStandardMaterial({
    map: texture, color, transparent: true, opacity, depthWrite: false, roughness, metalness,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    emissive: emissive ? new THREE.Color(color) : new THREE.Color(0), emissiveMap: emissive ? texture : null, emissiveIntensity: emissive,
  }));
  const d = new THREE.Mesh(g, mat);
  d.userData.decal = true;
  d.receiveShadow = true;
  d.raycast = () => {};
  return d;
}

const font = (w, size) => `${w} ${size}px "Chakra Petch", "Arial Narrow", sans-serif`;
const stencil = (size) => `700 ${size}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`;

/** Low-visibility tail code: wing code, serial and unit flash. */
export const tailCode = (code, serial, ink = 'rgba(38,44,50,0.95)') => decalTexture(`tail.${code}.${serial}`, 512, 512, (ctx, w, h) => {
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = font(700, 210);
  ctx.fillText(code, w / 2, h * 0.52);
  ctx.font = stencil(64);
  ctx.fillText(serial, w / 2, h * 0.72);
  ctx.fillRect(w * 0.12, h * 0.8, w * 0.76, 22);
});

/** Fictional low-visibility national emblem: a delta inside a ring with two bars. */
export const emblem = (ink = 'rgba(40,46,52,0.92)') => decalTexture(`emblem.${ink}`, 512, 256, (ctx, w, h) => {
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  ctx.lineWidth = 14;
  ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.4, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(w / 2, h * 0.18); ctx.lineTo(w / 2 + h * 0.28, h * 0.74); ctx.lineTo(w / 2 - h * 0.28, h * 0.74); ctx.closePath(); ctx.fill();
  ctx.fillRect(w * 0.06, h * 0.42, w * 0.26, h * 0.16);
  ctx.fillRect(w * 0.68, h * 0.42, w * 0.26, h * 0.16);
});

/** Small maintenance stencil. */
export const stencilText = (text, ink = 'rgba(30,34,38,0.9)', box = false) => decalTexture(`st.${text}.${ink}.${box}`, 512, 128, (ctx, w, h) => {
  ctx.fillStyle = ink; ctx.strokeStyle = ink;
  ctx.font = stencil(76);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 4);
  if (box) { ctx.lineWidth = 6; ctx.strokeRect(10, 10, w - 20, h - 20); }
});

/** Red intake / propeller danger marking with chevrons. */
export const danger = (text) => decalTexture(`danger.${text}`, 512, 160, (ctx, w, h) => {
  ctx.fillStyle = 'rgba(196,36,30,0.95)';
  ctx.fillRect(0, h * 0.62, w, h * 0.12);
  for (let x = 0; x < w; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, h * 0.86); ctx.lineTo(x + 32, h * 0.76); ctx.lineTo(x + 64, h * 0.86); ctx.lineTo(x + 64, h * 0.96); ctx.lineTo(x + 32, h * 0.86); ctx.lineTo(x, h * 0.96); ctx.fill();
  }
  ctx.font = stencil(70);
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h * 0.5);
});

/** Yellow-black rescue arrow and placard. */
export const rescue = () => decalTexture('rescue', 512, 256, (ctx, w, h) => {
  ctx.fillStyle = 'rgba(214,170,40,0.95)';
  ctx.beginPath(); ctx.moveTo(w * 0.05, h * 0.5); ctx.lineTo(w * 0.3, h * 0.2); ctx.lineTo(w * 0.3, h * 0.38); ctx.lineTo(w * 0.62, h * 0.38); ctx.lineTo(w * 0.62, h * 0.62); ctx.lineTo(w * 0.3, h * 0.62); ctx.lineTo(w * 0.3, h * 0.8); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(20,20,20,0.95)';
  ctx.font = stencil(58);
  ctx.fillText('RESCUE', w * 0.66, h * 0.58);
});

/** Panel outline (e.g. refuelling receptacle door) with fasteners. */
export const panelOutline = (key, ink = 'rgba(25,28,32,0.8)') => decalTexture(`panel.${key}`, 256, 256, (ctx, w, h) => {
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.roundRect(14, 14, w - 28, h - 28, 26); ctx.stroke();
  for (let t = 0.12; t < 0.9; t += 0.095) {
    for (const [x, y] of [[t * w, 30], [t * w, h - 30], [30, t * h], [w - 30, t * h]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill(); }
  }
});
