# Asset credits

## HDR environments and backdrops (`hdri/`)

| File | Used for | Source |
|------|----------|--------|
| `warehouse.exr` (2048 × 1024) | Hangar look, lighting | Poly Haven [Empty Warehouse 01](https://polyhaven.com/a/empty_warehouse_01), 2K EXR |
| `warehouse-8k.jpg`, `warehouse-4k.jpg` | Hangar look, backdrop | Poly Haven's tonemapped 8K JPG of the same HDRI; the 4K copy is a Lanczos downscale |
| `dawn.exr` (2048 × 1024) | Launch-pad look, lighting | Poly Haven [Kiara 1 Dawn](https://polyhaven.com/a/kiara_1_dawn), 2K EXR |
| `dawn-8k.jpg`, `dawn-4k.jpg` | Launch-pad look, backdrop | Poly Haven's tonemapped 8K JPG of the same HDRI; the 4K copy is a Lanczos downscale |
| `studio.exr` (2048 × 1024) | Studio look, lighting | Poly Haven [Studio Small 03](https://polyhaven.com/a/studio_small_03), 2K EXR |
| `sky.exr` (1024 × 512) | Open-sky look, lighting | Poly Haven [Kloofendal 48d Partly Cloudy (Pure Sky)](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky), 1K EXR |

Poly Haven assets are released under CC0. The 8K backdrops load for the 4K and Ultra graphics
presets on GPUs that accept 8192-pixel textures; other presets use the 4K copies.

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
