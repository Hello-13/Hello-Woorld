"""Point Cycles at the fastest device: OptiX (NVIDIA RTX), then CUDA, HIP (AMD), Metal (Apple),
oneAPI (Intel), else the CPU.

In a Blender script:
    import sys; sys.path.append("<this folder>")
    import blender_gpu; blender_gpu.enable()          # also sets the scene to render on it

Once, to make it the saved default in the Blender UI as well:
    blender -b --python blender_gpu.py -- --save
"""
import sys

import bpy

ORDER = ("OPTIX", "CUDA", "HIP", "METAL", "ONEAPI")


def enable(scene=None, save=False):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    chosen = None
    for kind in ORDER:
        try:
            prefs.compute_device_type = kind
        except TypeError:          # not compiled into this build of Blender
            continue
        prefs.refresh_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            chosen = kind
            break
    if chosen is None:
        prefs.compute_device_type = "NONE"
    for sc in [scene] if scene else bpy.data.scenes:
        sc.cycles.device = "GPU" if chosen else "CPU"
    if save:
        bpy.ops.wm.save_userpref()
    names = [d.name for d in prefs.devices if d.use and d.type == chosen] if chosen else ["CPU"]
    print(f"blender_gpu: {chosen or 'CPU'} -> {', '.join(names)}")
    return chosen or "CPU"


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    enable(save="--save" in argv)
