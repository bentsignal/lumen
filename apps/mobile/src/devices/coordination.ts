import {
  activeAreas,
  affectedLights,
  validateTVStatus,
  type Connection,
  type Resource,
  type TVStatus,
} from "./model.ts";

/** Release only our TV's area; another application's stream is never stopped. */
export async function prepareManualControl(
  bridge: Connection,
  tv: Connection | undefined,
  target: Resource,
  io: {
    readHue: (connection: Connection) => Promise<Resource[]>;
    readTV: (connection: Connection) => Promise<TVStatus>;
    handoff: (connection: Connection) => Promise<TVStatus>;
  },
) {
  const resources = await io.readHue(bridge);
  const current = resources.find((resource) => resource.id === target.id);
  if (!current)
    throw new Error(
      "This resource is no longer on the bridge. Refresh your lights.",
    );
  const lights = affectedLights(current, resources);
  if (!lights.length)
    throw new Error(
      "No controllable lights were found for this room or scene. Refresh the bridge.",
    );
  const active = activeAreas(resources, lights);
  const affected = new Set(lights);
  const couldSync = resources.some(
    (resource) =>
      resource.type === "entertainment_configuration" &&
      (!resource.light_services ||
        resource.light_services.some((ref) => affected.has(ref.rid))),
  );
  let status: TVStatus | undefined;
  if (tv && couldSync) {
    try {
      status = await io.readTV(tv);
    } catch {
      if (active.length)
        throw new Error(
          "TV is unavailable while these lights are streaming. Stop sync on the TV before changing them.",
        );
    }
  }
  if (
    active.some(
      (area) =>
        area.id !== status?.area ||
        status?.owner !== "ours" ||
        status?.bridgeId.toLowerCase() !== bridge.identity.toLowerCase(),
    )
  ) {
    throw new Error(
      "Another app is syncing these lights. Stop its sync before changing them.",
    );
  }
  const tvArea = resources.find((r) => r.id === status?.area);
  const overlaps =
    tvArea &&
    (!tvArea.light_services ||
      tvArea.light_services.some((ref) => affected.has(ref.rid)));
  if (
    tv &&
    status &&
    status.bridgeId.toLowerCase() === bridge.identity.toLowerCase() &&
    overlaps
  ) {
    const result = validateTVStatus(await io.handoff(tv));
    if (
      !result.restored ||
      result.streaming ||
      (!result.paused && result.mode !== "off")
    )
      throw new Error(
        "TV has not finished restoring ordinary lighting. Try again.",
      );
  }
  // Recheck ownership after restoration, before the actual light/scene command.
  if (activeAreas(await io.readHue(bridge), lights).length)
    throw new Error(
      "Sync is still using these lights. Try again after it stops.",
    );
}
