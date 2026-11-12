// Guided-tour content. Each step can focus parts (everything else is ghosted), choose a render
// mode, explode the assembly, aim the camera and run enter/exit actions on the vehicle or lab.
// `key` is the one idea to remember, usually an equation or a number with units.
//
// Step format: { title, body, key?, focus?: [part names], mode?, explode?: 0..1,
//                view?: { dir: [x, y, z], fill?, lift? }, demo?: name }
// One file per vehicle in ./tours/, keyed by the vehicle id.

export const TOURS = {};

/** Load the tours for these vehicle ids; one that fails to load is skipped, not fatal. */
export async function loadTours(ids) {
  await Promise.all(ids.map(async (id) => {
    try {
      TOURS[id] = (await import(`./tours/${id}.js`)).default;
    } catch (err) {
      console.error(`AEROFORGE: the ${id} tour could not be loaded`, err);
    }
  }));
}
