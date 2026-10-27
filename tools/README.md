# 3-D toolchain

`install-3d-tools.sh` installs the tools used to build detailed models for AEROFORGE and later
projects. It is idempotent (about 7 s when everything is present, about 3 min and 1.5 GB on a
fresh machine) and runs automatically at the start of every Claude Code cloud session on this
repository through `.claude/hooks/session-start.sh`.

| Command | What it is | Typical use |
|---|---|---|
| `blender -b --python s.py` | Blender 4.5 LTS, headless (Cycles on the CPU; EEVEE and Workbench on Mesa's software GL) | subdivision and bevelled hard-surface modelling, UV unwrapping, baking AO/normal/curvature maps, glTF export with `export_extras=True` so part metadata survives |
| `vsp`, `vspscript`, `py3d -c "import openvsp"` | NASA OpenVSP 3.55 | parametric aircraft geometry from real wing, airfoil and fuselage-section data; STL/OBJ/STEP export |
| `py3d` | Python with CadQuery, trimesh, manifold3d, numpy, scipy, shapely, OpenCV, Pillow, pygltflib, the OpenVSP API | precise mechanical parts (CadQuery), mesh analysis such as clash, watertightness and volume (trimesh, manifold3d), measuring reference photos (OpenCV) |
| `gltf-transform`, `gltfpack` | glTF optimisers | meshopt/Draco geometry compression, texture resizing, KTX2 conversion, scene inspection |
| `toktx`, `ktx` | KTX-Software 4.4 | KTX2 / Basis Universal GPU textures (UASTC for normal maps, ETC1S for colour) |
| `fetch-texture` | `tools/fetch-texture.py` | search and download CC0 PBR materials and HDRIs from ambientCG and Poly Haven, with a `SOURCE.txt` for credits |

Examples:

```bash
fetch-texture search "car paint"
fetch-texture get Metal032 --res 2k --out aeroforge/assets/textures/metal032
fetch-texture hdri industrial_workshop_foundry --res 4k --out aeroforge/assets/hdri
blender -b --python build_body.py -- --out body.glb
gltf-transform optimize body.glb body.min.glb --texture-compress ktx2
```

## On a Windows PC (GPU work)

`install-3d-tools.ps1` installs the same toolchain on Windows 10/11 for Claude Code sessions that
run on the PC itself (Claude Desktop, or `claude remote-control` in the repo folder), so Blender
renders and bakes on the local GPU. Everything goes under `%LOCALAPPDATA%\3d-tools` without admin
rights, except the KTX-Software installer, which asks once. It sets Cycles to OptiX on an NVIDIA
RTX card (CUDA, HIP, Metal or oneAPI elsewhere; `blender_gpu.py`), saved in Blender's preferences.

```powershell
powershell -ExecutionPolicy Bypass -File tools\install-3d-tools.ps1
# or without a checkout:
irm https://raw.githubusercontent.com/Hello-13/Hello-Woorld/master/tools/install-3d-tools.ps1 | iex
```

Open a new terminal afterwards so the PATH change applies. The regular Game Ready NVIDIA driver
is fine for Blender (OptiX and CUDA work on it); the Studio driver is not required.

In any Blender script, `import blender_gpu; blender_gpu.enable()` (with this folder on `sys.path`)
renders on the fastest device available, and falls back to the CPU in the cloud container.

## Notes

There is no GPU in the cloud container, so Cycles renders and bakes on 4 CPU cores; keep
previews small. Downloaded assets are data: keep them in their own directories. Everything on
ambientCG and Poly Haven is CC0.

To have the tools in every new cloud session (not only sessions on this repository), add this
line to the environment's setup script (the cloud environment menu in the session's title bar,
then Edit, then Setup script):

```bash
(curl -fsSL https://raw.githubusercontent.com/Hello-13/Hello-Woorld/master/tools/install-3d-tools.sh || curl -fsSL https://raw.githubusercontent.com/Hello-13/Hello-Woorld/claude/aerospace-3d-models-gjms7d/tools/install-3d-tools.sh) | bash
```

It takes the script from the default branch, or from the working branch until that is merged.
