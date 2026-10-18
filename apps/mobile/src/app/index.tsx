import { FieldGroup, Host, ListItem, Text } from "@expo/ui";

/** Bootstrap screen. Connection actions are the first implementation milestone. */
export default function HomeScreen() {
  return (
    <Host style={{ flex: 1 }}>
      <FieldGroup>
        <FieldGroup.Section title="Connections">
          <ListItem trailing={<Text>Not connected</Text>}>
            <Text>Hue Bridge</Text>
          </ListItem>
          <ListItem trailing={<Text>Not connected</Text>}>
            <Text>TV sync</Text>
          </ListItem>
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
