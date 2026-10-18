import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyEvents,
  hueData,
  pairingKey,
  bridgeAddress,
  deviceError,
  roomLights,
  validateTVStatus,
  type Resource,
  type TVStatus,
  type Connection,
} from "./model.ts";
import { prepareManualControl } from "./coordination.ts";

const bridge: Connection = {
  host: "bridge.local",
  port: 443,
  identity: "test-bridge",
  fingerprint: "test-pin",
  key: "test-key",
};
const tv = { ...bridge, host: "tv.local", port: 8766, identity: "lumen-tv" };
const light: Resource = {
  id: "light",
  type: "light",
  owner: { rid: "device", rtype: "device" },
  on: { on: true },
  dimming: { brightness: 50 },
  metadata: { name: "Lamp" },
};
const area: Resource = {
  id: "area",
  type: "entertainment_configuration",
  status: "active",
  light_services: [{ rid: "light", rtype: "light" }],
};
const status: TVStatus = {
  version: 1,
  deviceId: "tv",
  bridgeId: "test-bridge",
  area: "area",
  mode: "auto",
  paused: false,
  powered: true,
  streaming: true,
  owner: "ours",
  restored: false,
  capture: true,
  tuning: { brightness: 100, intensity: 100, softness: 150 },
};
const restored: TVStatus = {
  ...status,
  paused: true,
  streaming: false,
  owner: "none",
  restored: true,
};

test("manual address ports, native error messages, and unsupported TV capabilities are validated", () => {
  assert.deepEqual(bridgeAddress("hue.local"), {
    host: "hue.local",
    port: 443,
  });
  assert.deepEqual(bridgeAddress("hue.local:18443"), {
    host: "hue.local",
    port: 18443,
  });
  assert.throws(() => bridgeAddress("hue.local:0"));
  assert.throws(() => bridgeAddress("https://hue.local"));
  const error = deviceError(
    new Error(
      "FunctionCallException: Device certificate changed or was not trusted. Verify the device before pairing again. (native path)",
    ),
  );
  assert.equal(
    error.message,
    "Device certificate changed or was not trusted. Verify the device before pairing again.",
  );
  assert.throws(() =>
    validateTVStatus({
      ...status,
      tuning: { ...status.tuning, intensity: undefined as unknown as number },
    }),
  );
  assert.deepEqual(
    roomLights(
      {
        id: "zone",
        type: "zone",
        children: [{ rid: "light", rtype: "light" }],
      },
      [light],
    ),
    ["light"],
  );
});

test("partial Hue events merge nested state without losing name or capabilities", () => {
  const resources = [light];
  const result = applyEvents(resources, [
    {
      type: "update",
      data: [{ id: "light", type: "light", on: { on: false } }],
    },
  ]);
  assert.equal(result[0]?.on?.on, false);
  assert.equal(result[0]?.dimming?.brightness, 50);
  assert.equal(result[0]?.metadata?.name, "Lamp");
  assert.equal(resources[0]?.on?.on, true);
  assert.deepEqual(
    applyEvents(result, [{ type: "delete", data: [light] }]),
    [],
  );
  assert.equal(
    applyEvents([], [{ type: "add", data: [light] }])[0]?.id,
    "light",
  );
});

test("Hue errors and link-button pairing errors reject instead of appearing successful", () => {
  assert.throws(
    () => hueData({ errors: [{ description: "unauthorized" }], data: [] }),
    /unauthorized/,
  );
  assert.throws(() => pairingKey([{ error: { type: 101 } }]), /round button/);
  assert.throws(() => pairingKey([]), /rejected/);
  assert.equal(pairingKey([{ success: { username: "test-key" } }]), "test-key");
});

test("ordinary lighting works with the TV offline when its lights are not streaming", async () => {
  await prepareManualControl(bridge, tv, light, {
    readHue: async () => [light],
    readTV: async () => {
      throw new Error("offline");
    },
    handoff: async () => {
      throw new Error("must not handoff");
    },
  });
});

test("handoff waits for confirmed restoration and rechecks bridge before a scene", async () => {
  const calls: string[] = [];
  const room: Resource = {
    id: "room",
    type: "room",
    children: [{ rid: "device", rtype: "device" }],
  };
  const scene: Resource = {
    id: "scene",
    type: "scene",
    group: { rid: "room", rtype: "room" },
  };
  await prepareManualControl(bridge, tv, scene, {
    readHue: async () => {
      calls.push("read");
      return [
        light,
        room,
        scene,
        { ...area, status: calls.length === 1 ? "active" : "inactive" },
      ];
    },
    readTV: async () => {
      calls.push("status");
      return status;
    },
    handoff: async () => {
      calls.push("restore");
      return restored;
    },
  });
  assert.deepEqual(calls, ["read", "status", "restore", "read"]);
});

test("another application, mismatched bridge, failed restore, and restart races block manual commands", async () => {
  for (const owner of ["other", "ours"] as const) {
    await assert.rejects(
      prepareManualControl(bridge, tv, light, {
        readHue: async () => [light, area],
        readTV: async () => ({
          ...status,
          owner,
          bridgeId: owner === "ours" ? "wrong" : status.bridgeId,
        }),
        handoff: async () => {
          throw new Error("must not stop another app");
        },
      }),
      /Another app/,
    );
  }
  await assert.rejects(
    prepareManualControl(bridge, tv, light, {
      readHue: async () => [light, area],
      readTV: async () => status,
      handoff: async () => ({ ...restored, restored: false }),
    }),
    /not finished/,
  );
  await assert.rejects(
    prepareManualControl(bridge, tv, light, {
      readHue: async () => [light, area],
      readTV: async () => status,
      handoff: async () => restored,
    }),
    /still using/,
  );
});
