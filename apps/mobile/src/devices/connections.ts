import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import type { Connections } from "./model";

const key = ["connections"] as const;
const storageKey = "lumen.connections.v1";
export function useConnections() {
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<Connections> => {
      let value: string | null;
      try {
        value = await SecureStore.getItemAsync(storageKey);
      } catch {
        throw new Error(
          "Saved connections are unavailable. Unlock your iPhone and reopen Lumen.",
        );
      }
      return value ? JSON.parse(value) : {};
    },
    staleTime: Infinity,
    retry: false,
  });
}
export function useSaveConnections() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (connections: Connections) => {
      try {
        await SecureStore.setItemAsync(
          storageKey,
          JSON.stringify(connections),
          {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          },
        );
      } catch {
        throw new Error(
          "Lumen couldn't securely save this connection. Unlock your iPhone and try again.",
        );
      }
      return connections;
    },
    onSuccess: (connections) => {
      client.removeQueries({ queryKey: ["hue"] });
      client.removeQueries({ queryKey: ["tv"] });
      client.setQueryData(key, connections);
    },
  });
}
