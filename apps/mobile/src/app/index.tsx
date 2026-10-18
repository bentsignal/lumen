import { FieldGroup, Host, ListItem, Text } from "@expo/ui";
import { router } from "expo-router";
import { useConnections } from "~/devices/connections";
import type { TVStatus } from "~/devices/model";
import { useHue, useTV } from "~/devices/queries";
import { ErrorSection } from "~/components/controls";

export default function HomeScreen() {
  const connections = useConnections();
  const hue = useHue();
  const tv = useTV();
  const rooms = hue.data?.filter((r) => r.type === "room") ?? [];
  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Your home">
          <ListItem
            onPress={() => router.push("/connections")}
            trailing={<Text>›</Text>}
            supportingText={bridgeSummary(
              !!connections.data?.bridge,
              hue.isError,
              hue.isFetching,
            )}
          >
            <Text>Connections</Text>
          </ListItem>
          <ListItem
            onPress={() => router.push("/tv")}
            trailing={<Text>›</Text>}
            supportingText={tvSummary(
              !!connections.data?.tv,
              tv.isError,
              tv.data,
            )}
          >
            <Text>TV sync</Text>
          </ListItem>
        </FieldGroup.Section>
        <ErrorSection
          error={connections.error ?? hue.error}
          retry={() => void hue.refetch()}
        />
        {connections.data?.bridge && (
          <>
            <FieldGroup.Section title="Rooms">
              {rooms.map((room) => (
                <ListItem
                  key={room.id}
                  onPress={() =>
                    router.push({
                      pathname: "/resource",
                      params: { id: room.id },
                    })
                  }
                  trailing={<Text>›</Text>}
                >
                  <Text>{room.metadata?.name ?? "Room"}</Text>
                </ListItem>
              ))}
              {!rooms.length && (
                <Text>
                  {hue.isPending
                    ? "Loading rooms…"
                    : "No rooms found on this bridge"}
                </Text>
              )}
            </FieldGroup.Section>
            <FieldGroup.Section>
              <ListItem
                onPress={() => router.push("/lights")}
                trailing={<Text>›</Text>}
              >
                <Text>All lights</Text>
              </ListItem>
              <ListItem
                onPress={() => router.push("/scenes")}
                trailing={<Text>›</Text>}
              >
                <Text>Scenes</Text>
              </ListItem>
            </FieldGroup.Section>
          </>
        )}
      </FieldGroup>
    </Host>
  );
}

function bridgeSummary(paired: boolean, error: boolean, fetching: boolean) {
  if (!paired) return "Pair your Hue Bridge to get started";
  if (error) return "Bridge unavailable";
  if (fetching) return "Checking bridge…";
  return "Hue Bridge paired";
}
function tvSummary(saved: boolean, error: boolean, state?: TVStatus) {
  if (!saved) return "Connect your TV";
  if (error) return "TV unavailable";
  if (!state) return "Checking TV…";
  if (state.streaming) return "Syncing";
  if (state.paused) return "Paused until next power-on";
  if (state.mode === "off") return "Off";
  return "Waiting for TV capture";
}
