import { Alert, Linking } from "react-native";
import { Stack } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FieldGroup, Host, Text } from "@expo/ui";
import { SecureField, TextField, useNativeState } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  autocorrectionDisabled,
  textInputAutocapitalization,
} from "@expo/ui/swift-ui/modifiers";
import { ActionButton as Button, ErrorSection } from "~/components/controls";
import { useConnections, useSaveConnections } from "~/devices/connections";
import { bridgeAddress, pairingKey, type Connection } from "~/devices/model";
import { readHue, readTV } from "~/devices/queries";
import { probeBridge, request } from "~/devices/transport";

const inputModifiers = [
  autocorrectionDisabled(),
  textInputAutocapitalization("never"),
];

function BridgePairing() {
  const { data } = useConnections();
  const save = useSaveConnections();
  const host = useNativeState("");
  const identity = useNativeState("");
  const probe = useMutation({
    mutationFn: async () => {
      const connection: Connection = {
        ...bridgeAddress(host.get()),
        identity: identity.get().trim().toLowerCase(),
        fingerprint: "",
        key: "",
      };
      if (!/^[a-f0-9]{16}$/.test(connection.identity))
        throw new Error(
          "Enter the 16-character Bridge ID shown in the Hue app's bridge information.",
        );
      const result = await probeBridge(connection);
      return { ...connection, fingerprint: result.fingerprint };
    },
  });
  const pair = useMutation({
    mutationFn: async () => {
      if (!probe.data) throw new Error("Verify the bridge first.");
      const key = pairingKey(
        await request(probe.data, "/api", "POST", {
          devicetype: "lumen#ios",
          generateclientkey: false,
        }),
      );
      const bridge = { ...probe.data, key };
      await readHue(bridge);
      await save.mutateAsync({ ...data, bridge });
    },
  });
  return (
    <>
      <FieldGroup.Section title="Hue Bridge">
        {data?.bridge && (
          <Text>{`Paired · ${data.bridge.host}\nBridge ID · ${data.bridge.identity}`}</Text>
        )}
        <TextField
          key="bridge-address"
          text={host}
          placeholder="Bridge address"
          modifiers={[...inputModifiers, accessibilityLabel("Bridge address")]}
          onTextChange={(value) => {
            host.set(value);
            probe.reset();
          }}
        />
        <TextField
          key="bridge-id"
          text={identity}
          placeholder="Bridge ID from Hue app"
          maxLength={16}
          modifiers={[...inputModifiers, accessibilityLabel("Bridge ID")]}
          onTextChange={(value) => {
            identity.set(value);
            probe.reset();
          }}
        />
        <Button
          label={probe.isPending ? "Checking…" : "Verify bridge"}
          disabled={probe.isPending || pair.isPending}
          onPress={() => probe.mutate()}
        />
      </FieldGroup.Section>
      {probe.data && !pair.isSuccess && (
        <FieldGroup.Section title="Trust & pair">
          <Text>{`Check this Bridge ID in the Hue app: ${probe.data.identity}`}</Text>
          <Text>{`Certificate SHA-256\n${probe.data.fingerprint.match(/.{1,4}/g)?.join(" ")}`}</Text>
          <Text>
            Verify the fingerprint using a trusted local device. Then press the
            round button on your bridge.
          </Text>
          <Button
            label={pair.isPending ? "Pairing…" : "Trust this bridge & pair"}
            disabled={pair.isPending}
            onPress={() => pair.mutate()}
          />
        </FieldGroup.Section>
      )}
      {pair.isSuccess && (
        <FieldGroup.Section>
          <Text>Bridge paired. Your lights are ready.</Text>
        </FieldGroup.Section>
      )}
      <ErrorSection error={probe.error ?? pair.error ?? save.error} />
    </>
  );
}

function TVConnection() {
  const client = useQueryClient();
  const { data } = useConnections();
  const save = useSaveConnections();
  const host = useNativeState("");
  const fingerprint = useNativeState("");
  const key = useNativeState("");
  const connect = useMutation({
    mutationFn: async () => {
      const tv: Connection = {
        host: host.get().trim().toLowerCase(),
        port: 8766,
        identity: "lumen-tv",
        fingerprint: fingerprint.get().replace(/[\s:]/g, "").toLowerCase(),
        key: key.get().trim(),
      };
      if (!/^[a-f0-9]{64}$/.test(tv.fingerprint) || tv.key.length < 32)
        throw new Error(
          "Enter the helper's certificate fingerprint and access token from your private TV setup.",
        );
      await readTV(tv);
      await save.mutateAsync({ ...data, tv });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["tv"] }),
  });
  return (
    <>
      <FieldGroup.Section title="TV">
        {data?.tv && <Text>{`Saved · ${data.tv.host}`}</Text>}
        <Text>
          Enter the address, certificate fingerprint and access token from your
          TV's Lumen setup.
        </Text>
        <TextField
          text={host}
          placeholder="TV address"
          modifiers={[...inputModifiers, accessibilityLabel("TV address")]}
          onTextChange={(value) => host.set(value)}
        />
        <TextField
          text={fingerprint}
          placeholder="Certificate SHA-256"
          modifiers={[
            ...inputModifiers,
            accessibilityLabel("TV certificate fingerprint"),
          ]}
          onTextChange={(value) => fingerprint.set(value)}
        />
        <SecureField
          text={key}
          placeholder="Access token"
          modifiers={[...inputModifiers, accessibilityLabel("TV access token")]}
          onTextChange={(value) => key.set(value)}
        />
        <Button
          label={connect.isPending ? "Connecting…" : "Connect TV"}
          disabled={connect.isPending}
          onPress={() => connect.mutate()}
        />
        {connect.isSuccess && <Text>TV connected.</Text>}
      </FieldGroup.Section>
      <ErrorSection error={connect.error ?? save.error} />
    </>
  );
}

export default function ConnectionsScreen() {
  const connections = useConnections();
  const save = useSaveConnections();
  return (
    <Host style={{ flex: 1 }}>
      <Stack.Screen options={{ title: "Connections" }} />
      <FieldGroup>
        <BridgePairing />
        <TVConnection />
        <ErrorSection error={connections.error ?? save.error} />
        <FieldGroup.Section title="Access">
          <Button
            label="Open iOS settings"
            variant="text"
            onPress={() => void Linking.openSettings()}
          />
          {(connections.data?.bridge || connections.data?.tv) && (
            <Button
              label="Forget connections"
              variant="text"
              disabled={save.isPending}
              onPress={() =>
                Alert.alert(
                  "Forget connections?",
                  "Remove this phone's saved device credentials. The bridge pairing remains listed in Hue.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Forget",
                      style: "destructive",
                      onPress: () => save.mutate({}),
                    },
                  ],
                )
              }
            />
          )}
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
