import { useRef, useState, type ComponentProps } from "react";
import { Button as NativeButton, FieldGroup, Text } from "@expo/ui";
import { Slider, HStack, Spacer } from "@expo/ui/swift-ui";
import {
  accessibilityLabel,
  contentShape,
  shapes,
  disabled,
} from "@expo/ui/swift-ui/modifiers";

/** Make the whole native form row a touch target, including whitespace. */
export function ActionButton({
  label,
  variant = "filled",
  ...props
}: ComponentProps<typeof NativeButton>) {
  return (
    <NativeButton {...props} variant={variant}>
      <HStack modifiers={[contentShape(shapes.rectangle())]}>
        {variant !== "text" && <Spacer />}
        <Text>{label}</Text>
        <Spacer />
      </HStack>
    </NativeButton>
  );
}

export function ErrorSection({
  error,
  retry,
}: {
  error: Error | null;
  retry?: () => void;
}) {
  if (!error) return null;
  return (
    <FieldGroup.Section title="Needs attention">
      <Text>{error.message}</Text>
      {retry && <ActionButton label="Retry" variant="text" onPress={retry} />}
    </FieldGroup.Section>
  );
}

/** The draft belongs to the gesture. One write occurs when editing ends. Apply also supports accessibility adjustments. */
export function CommitSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  suffix = "%",
  busy = false,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  busy?: boolean;
  onCommit: (value: number) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const latest = useRef(value);
  const shown = draft ?? value;
  return (
    <>
      <Text>{`${label} · ${Math.round(shown)}${suffix}`}</Text>
      <Slider
        value={shown}
        min={min}
        max={max}
        step={step}
        modifiers={[accessibilityLabel(label), disabled(busy)]}
        onValueChange={(next) => {
          latest.current = next;
          setDraft(next);
        }}
        onEditingChanged={(editing) => {
          if (!editing)
            void onCommit(latest.current)
              .finally(() => setDraft(null))
              .catch(() => {});
        }}
      />
      {draft !== null && !busy && (
        <ActionButton
          label={`Apply ${label.toLowerCase()}`}
          variant="text"
          onPress={() =>
            void onCommit(latest.current)
              .finally(() => setDraft(null))
              .catch(() => {})
          }
        />
      )}
    </>
  );
}
