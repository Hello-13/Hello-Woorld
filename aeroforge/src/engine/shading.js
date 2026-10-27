// Shader-level fixes applied to every built-in lit material, installed once before anything
// compiles.
//
// Specular antialiasing. A glossy curved surface (a canopy, a polished spinner) reflects each
// light as a highlight smaller than a pixel. Whether a pixel centre lands on it changes from frame
// to frame as the view moves, so the highlight blinks on and off, and bloom spreads each blink.
// Following Tokuyoshi & Kaplanyan, "Improved Geometric Specular Antialiasing" (2019), the GGX
// lobe is widened by the variance of the shading normal across the pixel's footprint: the
// highlight then covers whole pixels and slides smoothly instead of flashing. Its effect shrinks
// as resolution grows, because the normal changes less from one pixel to the next.
//
// Highlight clamp. A GGX peak on a near-mirror reaches tens of thousands of times the scene's
// white, far past anything tone mapping can show. Each sample is limited to HDR_LIMIT (keeping
// its hue) before multisampling averages it, so one bright sample cannot dominate a pixel and
// bloom does not turn a single glint into a flash. Emissive lights and lamps stay far below it.

import * as THREE from 'three';

export const HDR_LIMIT = 64;

// variance of a box pixel filter (0.25) and the maximum added roughness² (0.18), from the paper
const SAA = /* glsl */`
float specularAAKernel( const in vec3 n ) {
	vec3 du = dFdx( n ), dv = dFdy( n );
	return min( 2.0 * 0.25 * ( dot( du, du ) + dot( dv, dv ) ), 0.18 );
}
// perceptual roughness with its GGX alpha² widened by the kernel
float specularAARoughness( const in float roughness, const in float kernel ) {
	return min( sqrt( sqrt( pow4( max( roughness, 0.0525 ) ) + kernel ) ), 1.0 );
}
`;

// three's published build strips comments and blank lines from its chunks, so statements are
// matched with flexible whitespace rather than as exact text
const stmt = (code) => new RegExp(code.trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'));

function patch(name, find, replace) {
  const src = THREE.ShaderChunk[name];
  const re = stmt(find);
  if (!re.test(src)) {
    console.warn(`AEROFORGE shading: ShaderChunk.${name} has changed; a patch was not applied`);
    return;
  }
  THREE.ShaderChunk[name] = src.replace(re, replace);
}

let installed = false;

export function installShading() {
  if (installed) return;
  installed = true;

  // fragment-only chunk (derivatives do not exist in vertex shaders), included before main()
  THREE.ShaderChunk.lights_physical_pars_fragment = SAA + THREE.ShaderChunk.lights_physical_pars_fragment;

  // the shading normal after normal mapping, so fine bump detail is filtered too
  patch('lights_physical_fragment', 'material.roughness = max( roughnessFactor, 0.0525 );',
    'material.roughness = specularAARoughness( roughnessFactor, specularAAKernel( normal ) );');
  patch('lights_physical_fragment', 'material.roughness += geometryRoughness;', '');
  patch('lights_physical_fragment', 'material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );',
    'material.clearcoatRoughness = specularAARoughness( material.clearcoatRoughness, specularAAKernel( clearcoatNormal ) );');
  patch('lights_physical_fragment', 'material.clearcoatRoughness += geometryRoughness;', '');

  patch('opaque_fragment',
    'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
    /* glsl */`gl_FragColor = vec4( outgoingLight * min( 1.0, ${HDR_LIMIT.toFixed(1)} / max( max( outgoingLight.r, outgoingLight.g ), max( outgoingLight.b, 1e-4 ) ) ), diffuseColor.a );`);
}
