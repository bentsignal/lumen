export type Ref = { rid: string; rtype: string };
export type Resource = {
  id: string;
  type: string;
  metadata?: { name?: string };
  owner?: Ref;
  services?: Ref[];
  children?: Ref[];
  group?: Ref;
  on?: { on: boolean };
  dimming?: { brightness: number };
  status?: string;
  active_streamer?: Ref;
  light_services?: Ref[];
  [key: string]: unknown;
};
export type Connection = {
  host: string;
  port: number;
  identity: string;
  fingerprint: string;
  key: string;
};
export type Connections = { bridge?: Connection; tv?: Connection };
export function deviceError(error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error);
  const messages = [
    "Enter a private IPv4 address or a .local hostname.",
    "Bridge identity does not match. Check the Bridge ID in the Hue app.",
    "Device certificate changed or was not trusted. Verify the device before pairing again.",
    "The device redirected the request. No credentials were forwarded.",
    "The device returned an unexpected response.",
    "Device response exceeded the safety limit.",
    "Pairing expired or the device token was rejected. Reconnect in Connections.",
    "Cannot reach this device. Check Wi-Fi, its address, and Settings → Privacy & Security → Local Network → Lumen.",
    "Install the Lumen development build to connect local devices. Expo Go does not include its certificate trust module.",
  ];
  return new Error(
    messages.find((message) => detail.includes(message)) ??
      "The device request failed. Check its connection and try again.",
  );
}
export function bridgeAddress(raw: string) {
  const [host = "", port = "443", extra] = raw.trim().toLowerCase().split(":");
  const number = Number(port);
  if (
    extra !== undefined ||
    !/^\d+$/.test(port) ||
    !Number.isInteger(number) ||
    number < 1 ||
    number > 65535
  )
    throw new Error("Enter a bridge address with an optional HTTPS port.");
  return { host, port: number };
}
export type HueEvent = {
  type: "add" | "update" | "delete";
  data: Resource[];
};

function merge(current: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object" || Array.isArray(patch))
    return patch;
  const result = {
    ...(current && typeof current === "object" ? current : {}),
  } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch))
    result[key] = merge(result[key], value);
  return result;
}

/** Events update only bridge-authoritative data. Arrays replace, nested properties merge. */
export function applyEvents(
  resources: Resource[],
  events: HueEvent[],
): Resource[] {
  const result = new Map(resources.map((resource) => [resource.id, resource]));
  for (const event of events) {
    for (const patch of event.data) {
      if (event.type === "delete") result.delete(patch.id);
      else if (event.type === "add" || result.has(patch.id)) {
        result.set(patch.id, merge(result.get(patch.id), patch) as Resource);
      }
    }
  }
  return [...result.values()];
}

export function roomLights(room: Resource, resources: Resource[]): string[] {
  const children = new Set(room.children?.map((ref) => ref.rid));
  return resources
    .filter(
      (r) =>
        r.type === "light" &&
        (children.has(r.id) || (r.owner && children.has(r.owner.rid))),
    )
    .map((r) => r.id);
}

export function affectedLights(
  resource: Resource,
  resources: Resource[],
): string[] {
  if (resource.type === "light") return [resource.id];
  const room =
    resource.type === "scene"
      ? resources.find((r) => r.id === resource.group?.rid)
      : resource;
  if (!room)
    throw new Error("This scene's room is unavailable. Refresh the bridge.");
  return roomLights(room, resources);
}

export function activeAreas(
  resources: Resource[],
  lights: string[],
): Resource[] {
  const affected = new Set(lights);
  return resources.filter(
    (r) =>
      r.type === "entertainment_configuration" &&
      r.status === "active" &&
      // An older bridge with no light_services is treated conservatively.
      (!r.light_services ||
        r.light_services.some((ref) => affected.has(ref.rid))),
  );
}

export function hueData<T>(response: {
  data?: T;
  errors?: { description?: string }[];
}): T {
  if (response.errors?.length)
    throw new Error(
      response.errors
        .map((e) => e.description ?? "Hue rejected the command")
        .join(". "),
    );
  if (!response.data)
    throw new Error("Unexpected Hue response. Update or reconnect the bridge.");
  return response.data;
}

export function pairingKey(
  response: { error?: { type: number }; success?: { username?: string } }[],
): string {
  if (response.some((r) => r.error?.type === 101))
    throw new Error(
      "Press the round button on your Hue Bridge, then tap Pair again.",
    );
  const key = response.find((r) => r.success?.username)?.success?.username;
  if (!key)
    throw new Error(
      "The bridge rejected pairing. Check its button and try again.",
    );
  return key;
}

export type TVStatus = {
  version: 1;
  deviceId: string;
  mode: "auto" | "on" | "off";
  paused: boolean;
  powered: boolean | null;
  streaming: boolean;
  owner: "ours" | "other" | "none";
  area: string;
  bridgeId: string;
  restored: boolean;
  capture: boolean;
  tuning: { brightness: number; intensity: number; softness: number };
};

export function validateTVStatus(value: TVStatus): TVStatus {
  if (
    value.version !== 1 ||
    typeof value.deviceId !== "string" ||
    !value.deviceId ||
    !["auto", "on", "off"].includes(value.mode) ||
    typeof value.paused !== "boolean" ||
    typeof value.restored !== "boolean" ||
    !["ours", "other", "none"].includes(value.owner) ||
    typeof value.bridgeId !== "string" ||
    !value.bridgeId ||
    typeof value.area !== "string" ||
    !value.area ||
    typeof value.streaming !== "boolean" ||
    typeof value.capture !== "boolean" ||
    (value.powered !== null && typeof value.powered !== "boolean") ||
    !value.tuning ||
    !Object.values(value.tuning).every(Number.isFinite) ||
    ![
      value.tuning.softness,
      value.tuning.brightness,
      value.tuning.intensity,
    ].every(Number.isFinite)
  ) {
    throw new Error(
      "This TV needs the Lumen policy helper v1. See the TV setup guide.",
    );
  }
  return value;
}
