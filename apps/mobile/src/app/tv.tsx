import { FieldGroup, Host, ListItem, Picker, Text } from "@expo/ui";
import { router, Stack } from "expo-router";
import {
  ActionButton as Button,
  CommitSlider,
  ErrorSection,
} from "~/components/controls";
import { useConnections } from "~/devices/connections";
import type { TVStatus } from "~/devices/model";
import { useTV, useTVCommand } from "~/devices/queries";

export default function TVScreen() {
  const { data } = useConnections();
  const tv = useTV();
  const command = useTVCommand();
  const state = tv.data;
  const busy = command.isPending || tv.isError;
  const pending =
    command.isPending && command.variables.path === "policy"
      ? (command.variables.value as { mode?: string })
      : undefined;
  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "TV sync" }} />
      <FieldGroup>
        {!data?.tv && (
          <FieldGroup.Section>
            <Text>Connect your TV to control video sync.</Text>
            <Button
              label="Connections"
              onPress={() => router.push("/connections")}
            />
          </FieldGroup.Section>
        )}
        <ErrorSection
          error={tv.error ?? command.error}
          retry={() => void tv.refetch()}
        />
        {data?.tv && !state && !tv.error && (
          <FieldGroup.Section>
            <Text>Checking TV…</Text>
          </FieldGroup.Section>
        )}
        {state && (
          <>
            <FieldGroup.Section title="Sync">
              <ListItem trailing={<Text>{syncStatus(tv.isError, state)}</Text>}>
                <Text>Status</Text>
              </ListItem>
              <Picker
                selectedValue={pending?.mode ?? state.mode}
                enabled={!busy}
                onValueChange={(mode) =>
                  command.mutate({
                    path: "policy",
                    value: { mode, paused: false },
                  })
                }
              >
                <Picker.Item label="Auto" value="auto" />
                <Picker.Item label="On" value="on" />
                <Picker.Item label="Off" value="off" />
              </Picker>
              <Button
                label={
                  state.paused ? "Resume sync" : "Pause until next power-on"
                }
                variant="text"
                disabled={busy || state.mode === "off"}
                onPress={() =>
                  command.mutate({
                    path: "policy",
                    value: { paused: !state.paused },
                  })
                }
              />
            </FieldGroup.Section>
            <FieldGroup.Section title="Presets">
              {(["Calm", "Balanced", "Action"] as const).map((preset) => (
                <Button
                  key={preset}
                  label={preset === "Balanced" ? "Balanced · 150 ms" : preset}
                  variant="text"
                  disabled={busy}
                  onPress={() =>
                    command.mutate({
                      path: "tuning",
                      value: { preset: preset.toLowerCase() },
                    })
                  }
                />
              ))}
            </FieldGroup.Section>
            <FieldGroup.Section title="Tune">
              <CommitSlider
                label="Brightness ceiling"
                value={state.tuning.brightness}
                min={1}
                busy={busy}
                onCommit={(brightness) =>
                  command.mutateAsync({ path: "tuning", value: { brightness } })
                }
              />
              <CommitSlider
                label="Color intensity"
                value={state.tuning.intensity}
                busy={busy}
                onCommit={(intensity) =>
                  command.mutateAsync({ path: "tuning", value: { intensity } })
                }
              />
              <CommitSlider
                label="Transition softness"
                value={state.tuning.softness}
                min={75}
                max={500}
                step={25}
                suffix=" ms"
                busy={busy}
                onCommit={(softness) =>
                  command.mutateAsync({ path: "tuning", value: { softness } })
                }
              />
            </FieldGroup.Section>
          </>
        )}
      </FieldGroup>
    </Host>
  );
}

function syncStatus(unavailable: boolean, state: TVStatus) {
  if (unavailable) return "Unavailable";
  if (state.owner === "other") return "Another app is syncing";
  if (state.streaming) return "Syncing";
  if (state.paused) return "Paused";
  if (state.mode === "off") return "Off";
  if (state.powered === null) return "Checking TV power…";
  if (!state.powered) return "TV inactive";
  if (!state.capture) return "Waiting for capture";
  return "Ready";
}
