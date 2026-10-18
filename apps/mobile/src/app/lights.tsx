import { FieldGroup, Host, ListItem, Text } from "@expo/ui";
import { router, Stack } from "expo-router";
import { ErrorSection } from "~/components/controls";
import { useHue } from "~/devices/queries";

export default function LightsScreen() {
  const hue = useHue();
  const lights = hue.data?.filter((r) => r.type === "light") ?? [];
  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Lights" }} />
      <FieldGroup>
        <ErrorSection error={hue.error} retry={() => void hue.refetch()} />
        <FieldGroup.Section>
          {lights.map((light) => (
            <ListItem
              key={light.id}
              onPress={() =>
                router.push({ pathname: "/resource", params: { id: light.id } })
              }
              trailing={
                <Text>
                  {light.on?.on
                    ? `${Math.round(light.dimming?.brightness ?? 100)}%`
                    : "Off"}
                </Text>
              }
            >
              <Text>{light.metadata?.name ?? "Light"}</Text>
            </ListItem>
          ))}
          {!lights.length && (
            <Text>{hue.isPending ? "Loading lights…" : "No lights found"}</Text>
          )}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
