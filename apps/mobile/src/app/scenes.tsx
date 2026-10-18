import { FieldGroup, Host, Text } from "@expo/ui";
import { Stack } from "expo-router";
import { ActionButton as Button, ErrorSection } from "~/components/controls";
import type { Resource } from "~/devices/model";
import { useHue, useLightCommand } from "~/devices/queries";

function Scene({
  scene,
  unavailable,
}: {
  scene: Resource;
  unavailable: boolean;
}) {
  const command = useLightCommand(scene);
  return (
    <>
      <Button
        label={
          command.isPending
            ? `Applying ${scene.metadata?.name ?? "scene"}…`
            : (scene.metadata?.name ?? "Scene")
        }
        variant="text"
        disabled={command.isPending || unavailable}
        onPress={() => command.mutate({ recall: { action: "active" } })}
      />
      {command.error && <Text>{command.error.message}</Text>}
    </>
  );
}
export default function ScenesScreen() {
  const hue = useHue();
  const scenes = hue.data?.filter((r) => r.type === "scene") ?? [];
  const groups = [...new Set(scenes.map((r) => r.group?.rid))];
  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Scenes" }} />
      <FieldGroup>
        <ErrorSection error={hue.error} retry={() => void hue.refetch()} />
        {groups.map((group) => (
          <FieldGroup.Section
            key={group ?? "other"}
            title={
              hue.data?.find((r) => r.id === group)?.metadata?.name ?? "Scenes"
            }
          >
            {scenes
              .filter((r) => r.group?.rid === group)
              .map((scene) => (
                <Scene key={scene.id} scene={scene} unavailable={hue.isError} />
              ))}
          </FieldGroup.Section>
        ))}
        {!scenes.length && (
          <FieldGroup.Section>
            <Text>
              {hue.isPending
                ? "Loading scenes…"
                : "No scenes found. Scenes created in Hue appear here."}
            </Text>
          </FieldGroup.Section>
        )}
      </FieldGroup>
    </Host>
  );
}
