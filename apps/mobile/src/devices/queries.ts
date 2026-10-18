import { useEffect } from "react";
import { AppState } from "react-native";
import {
  focusManager,
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useConnections } from "./connections";
import {
  applyEvents,
  hueData,
  validateTVStatus,
  type Connection,
  type HueEvent,
  type Resource,
  type TVStatus,
} from "./model";
import { prepareManualControl } from "./coordination";
import { lan, request } from "./transport";

export const hueKey = (connection?: Connection) =>
  [
    "hue",
    connection?.identity,
    connection?.host,
    connection?.fingerprint,
  ] as const;
export const tvKey = (connection?: Connection) =>
  [
    "tv",
    connection?.identity,
    connection?.host,
    connection?.fingerprint,
  ] as const;
export async function readHue(connection: Connection): Promise<Resource[]> {
  return hueData(await request(connection, "/clip/v2/resource"));
}
export async function readTV(connection: Connection): Promise<TVStatus> {
  return validateTVStatus(await request(connection, "/v1/status"));
}
export function useHue() {
  const { data } = useConnections();
  const bridge = data?.bridge;
  return useQuery({
    queryKey: hueKey(bridge),
    queryFn: () => readHue(bridge!),
    enabled: !!bridge,
    retry: 1,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
export function useTV() {
  const { data } = useConnections();
  const tv = data?.tv;
  return useQuery({
    queryKey: tvKey(tv),
    queryFn: () => readTV(tv!),
    enabled: !!tv,
    retry: 1,
    staleTime: 3_000,
    refetchInterval: 5_000,
  });
}

export function DeviceEvents() {
  const client = useQueryClient();
  const { data } = useConnections();
  const bridge = data?.bridge;
  // eslint-disable-next-line no-restricted-syntax -- Subscribe to iOS foreground/background and native Hue events; the subscription owns and cancels its timers and listeners.
  useEffect(() => subscribeDeviceEvents(client, bridge), [bridge, client]);
  return null;
}

function subscribeDeviceEvents(client: QueryClient, bridge?: Connection) {
  let active = AppState.currentState === "active";
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  let reconcile: ReturnType<typeof setTimeout> | undefined;
  let delay = 1000;
  let disposed = false;
  let generation = 0;
  let subscription: { remove(): void } | undefined;
  const eventsKey = ["hue-events", bridge?.identity];
  function start() {
    if (!active || disposed || !bridge) return;
    clearTimeout(reconnect);
    client.setQueryData(eventsKey, "Connecting");
    try {
      generation += 1;
      lan().startEvents(bridge, String(generation));
    } catch {
      client.setQueryData(eventsKey, "Unavailable in this build");
    }
  }
  if (bridge) {
    try {
      subscription = lan().addListener("hueEvent", (event) => {
        if (!active || disposed || event.generation !== String(generation))
          return;
        if (event.state === "connected") {
          delay = 1000;
          client.setQueryData(eventsKey, "Live updates");
          void client.invalidateQueries({ queryKey: hueKey(bridge) });
        } else if (event.state === "data" && event.data) {
          try {
            const events = JSON.parse(event.data) as HueEvent[];
            client.setQueryData<Resource[]>(hueKey(bridge), (resources) =>
              resources ? applyEvents(resources, events) : undefined,
            );
          } catch {
            /* A malformed event triggers a full authoritative read below. */
          }
          clearTimeout(reconcile);
          reconcile = setTimeout(
            () => void client.invalidateQueries({ queryKey: hueKey(bridge) }),
            750,
          );
        } else {
          client.setQueryData(
            eventsKey,
            event.state === "trust-error"
              ? "Certificate changed — reconnect"
              : "Reconnecting",
          );
          if (event.state !== "trust-error") {
            clearTimeout(reconnect);
            reconnect = setTimeout(start, delay);
            delay = Math.min(delay * 2, 30_000);
          }
        }
      });
    } catch {
      client.setQueryData(eventsKey, "Unavailable in this build");
    }
  }
  focusManager.setFocused(active);
  start();
  const appState = AppState.addEventListener("change", (state) => {
    active = state === "active";
    focusManager.setFocused(active);
    clearTimeout(reconnect);
    clearTimeout(reconcile);
    if (active) {
      void client.invalidateQueries({ queryKey: ["hue"] });
      void client.invalidateQueries({ queryKey: ["tv"] });
      start();
    } else {
      generation += 1;
      if (subscription) lan().stopEvents();
      client.setQueryData(eventsKey, "Paused in background");
    }
  });
  return () => {
    disposed = true;
    appState.remove();
    subscription?.remove();
    clearTimeout(reconnect);
    clearTimeout(reconcile);
    if (subscription) lan().stopEvents();
  };
}

export function useLightCommand(resource: Resource) {
  const { data } = useConnections();
  const client = useQueryClient();
  return useMutation({
    mutationKey: ["light-command", resource.id],
    scope: { id: "home-controls" },
    mutationFn: async (state: {
      on?: { on: boolean };
      dimming?: { brightness: number };
      recall?: { action: string };
    }) => {
      if (!data?.bridge) throw new Error("Connect a Hue Bridge first.");
      await prepareManualControl(data.bridge, data.tv, resource, {
        readHue,
        readTV,
        handoff: (tv) => request<TVStatus>(tv, "/v1/handoff", "POST", {}),
      });
      const service =
        resource.type === "room" || resource.type === "zone"
          ? resource.services?.find((r) => r.rtype === "grouped_light")
          : undefined;
      const path = service
        ? `${service.rtype}/${service.rid}`
        : `${resource.type}/${resource.id}`;
      hueData(
        await request(data.bridge, `/clip/v2/resource/${path}`, "PUT", state),
      );
    },
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["hue"] }),
        client.invalidateQueries({ queryKey: ["tv"] }),
      ]);
    },
  });
}

export function useTVCommand() {
  const { data } = useConnections();
  const client = useQueryClient();
  return useMutation({
    scope: { id: "home-controls" },
    mutationFn: async ({
      path,
      value,
    }: {
      path: "policy" | "tuning";
      value: unknown;
    }) => {
      if (!data?.tv) throw new Error("Connect a TV first.");
      return validateTVStatus(
        await request(data.tv, `/v1/${path}`, "POST", value),
      );
    },
    onSuccess: (status) => client.setQueryData(tvKey(data?.tv), status),
    onSettled: () => client.invalidateQueries({ queryKey: ["tv"] }),
  });
}
