import { FieldGroup, Host, Switch, Text } from "@expo/ui";
import { Stack, useLocalSearchParams } from "expo-router";
import { CommitSlider, ErrorSection } from "~/components/controls";
import type { Resource } from "~/devices/model";
import { useHue, useLightCommand } from "~/devices/queries";

function LightControls({
  resource,
  state,
  unavailable,
}: {
  resource: Resource;
  state: Resource;
  unavailable: boolean;
}) {
  const command = useLightCommand(resource);
  const pending = command.isPending ? command.variables : undefined;
  return (
    <>
      <FieldGroup.Section>
        {state.on && (
          <Switch
            label="Power"
            value={pending?.on?.on ?? state.on.on}
            disabled={command.isPending || unavailable}
            onValueChange={(on) => command.mutate({ on: { on } })}
          />
        )}
        {state.dimming && (
          <CommitSlider
            label="Brightness"
            min={1}
            value={pending?.dimming?.brightness ?? state.dimming.brightness}
            busy={command.isPending || unavailable}
            onCommit={(brightness) =>
              command.mutateAsync({ dimming: { brightness } })
            }
          />
        )}
        {!state.on && !state.dimming && (
          <Text>Controls are unavailable for this resource.</Text>
        )}
      </FieldGroup.Section>
      <ErrorSection error={command.error} />
    </>
  );
}
export default function ResourceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hue = useHue();
  const resource = hue.data?.find((r) => r.id === id);
  const service = resource?.services?.find((s) => s.rtype === "grouped_light");
  const state = hue.data?.find((r) => r.id === service?.rid) ?? resource;
  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: resource?.metadata?.name ?? "Light controls" }}
      />
      <FieldGroup>
        <ErrorSection error={hue.error} retry={() => void hue.refetch()} />
        {resource && state ? (
          <LightControls
            key={resource.id}
            resource={resource}
            state={state}
            unavailable={hue.isError}
          />
        ) : (
          <FieldGroup.Section>
            <Text>
              {hue.isPending
                ? "Loading…"
                : "This resource is no longer on the bridge."}
            </Text>
          </FieldGroup.Section>
        )}
      </FieldGroup>
    </Host>
  );
}
