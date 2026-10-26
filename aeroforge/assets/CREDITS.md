# Asset credits

## HDR environments and backdrops (`hdri/`)

| File | Used for | Source |
|------|----------|--------|
| `warehouse.exr` (2048 × 1024) | Hangar look, lighting | Poly Haven [Empty Warehouse 01](https://polyhaven.com/a/empty_warehouse_01), 2K EXR |
| `warehouse-8k.jpg`, `warehouse-4k.jpg` | Hangar look, backdrop | Poly Haven's tonemapped 8K JPG of the same HDRI; the 4K copy is a Lanczos downscale |
| `dawn.exr` (2048 × 1024) | Launch-pad look, lighting | Poly Haven [Kiara 1 Dawn](https://polyhaven.com/a/kiara_1_dawn), 2K EXR |
| `dawn-8k.jpg`, `dawn-4k.jpg` | Launch-pad look, backdrop | Poly Haven's tonemapped 8K JPG of the same HDRI; the 4K copy is a Lanczos downscale |
| `studio.exr` (2048 × 1024) | Studio look, lighting | Poly Haven [Studio Small 03](https://polyhaven.com/a/studio_small_03), 2K EXR |
| `sky.exr` (1024 × 512, 5.0 MB) | Open-sky look, lighting | Poly Haven [Kloofendal 43d Clear (Pure Sky)](https://polyhaven.com/a/kloofendal_43d_clear_puresky), 1K EXR |
| `sky-8k.jpg` (8192 × 4096, 1.1 MB), `sky-4k.jpg` (4096 × 2048, 0.3 MB) | Open-sky look, the sky above the horizon | The same HDRI's 8K Radiance HDR, tone-mapped by our own plates script: radiance kept 1:1 up to 0.5, rolled off above it with a luminance shoulder y = K + (1 − K)(1 − e^−(x−K)/1.6) that the sky shader (src/engine/sky.js) inverts, so the sun's aureole decodes back to HDR; triangular dither before quantisation; the 4K copy is a Lanczos downscale |

Poly Haven assets are released under CC0. The 8K backdrops load for the 4K and Ultra graphics
presets on GPUs that accept 8192-pixel textures; other presets use the 4K copies. The cloud deck
under the open-sky look is procedural (tileable gradient noise generated at run time), not an asset.

## Earth textures (`earth/`)

| File | Content | Source |
|------|---------|--------|
| `day-8k.jpg`, `day.jpg` (4K) | Daytime surface colour with relief | NASA Visible Earth, Blue Marble Next Generation, July 2004 (`world.topo.200407.3x21600x10800.jpg`), downscaled |
| `night-8k.jpg`, `night.jpg` (4K) | City lights | NASA Earth Observatory, Black Marble 2016 (`BlackMarble_2016_3km.jpg`), downscaled |
| `clouds-8k.jpg`, `clouds.jpg` (4K) | Cloud cover | NASA Visible Earth, Blue Marble cloud composite (`cloud_combined_8192.tif`) |
| `bump.jpg` (4K) | Terrain relief | NASA Visible Earth, GEBCO 2008 elevation (`gebco_08_rev_elev_21600x10800.png`), downscaled |
| `water.png` (4K) | Ocean mask for sun glint | Derived from the same GEBCO elevation (zero elevation is water) |

NASA imagery is not copyrighted (see NASA's media usage guidelines). The 8K day, night and
cloud maps load for the 4K and Ultra presets; other presets use the 4K set.

- https://polyhaven.com/hdris
- https://visibleearth.nasa.gov/collection/1484/blue-marble
- https://earthobservatory.nasa.gov/features/NightLights
