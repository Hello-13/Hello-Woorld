# Asset credits

## HDR environment maps (`hdri/`)

| File | Used for | Source |
|------|----------|--------|
| `warehouse.exr` | Hangar look | Poly Haven HDRI, via `@pmndrs/assets` 1.7.0 (`hdri/warehouse.exr`) |
| `studio.exr` | Studio look | Poly Haven HDRI, via `@pmndrs/assets` 1.7.0 (`hdri/studio.exr`) |
| `sky.exr` | Open-sky look (lighting) | Poly Haven HDRI, via `@pmndrs/assets` 1.7.0 (`hdri/sky.exr`) |
| `dawn.exr` | Launch-pad look | Poly Haven HDRI, via `@pmndrs/assets` 1.7.0 (`hdri/dawn.exr`) |

Poly Haven HDRIs are released under CC0. `@pmndrs/assets` (CC0-1.0) redistributes a selection
resized to 512 px and recompressed as DWAB EXR; the files here are those EXRs, decoded from the
package's base64 modules.

- https://polyhaven.com/hdris
- https://github.com/pmndrs/assets

## Earth textures (`earth/`)

| File | Content | Source |
|------|---------|--------|
| `day.jpg` | Daytime surface colour | NASA Blue Marble imagery, from the `three-globe` 2.31.0 example images |
| `night.jpg` | City lights | NASA Black Marble / Earth at Night imagery, from the `three-globe` 2.31.0 example images |
| `bump.jpg` | Topography (relief shading) | NASA-derived topography, from the `three-globe` 2.31.0 example images |
| `water.png` | Ocean mask (specular glint) | NASA-derived land/water mask, from the `three-globe` 2.31.0 example images |
| `clouds.jpg` | Cloud cover | NASA-derived cloud map from `turban/webgl-earth`, as bundled in the `three-globe` cloud example; recompressed |

NASA imagery is generally not copyrighted (see NASA's media usage guidelines). `three-globe`
is MIT-licensed (© Vasco Asturiano).

- https://visibleearth.nasa.gov/collection/1484/blue-marble
- https://github.com/vasturiano/three-globe
- https://github.com/turban/webgl-earth
