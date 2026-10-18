import { useState } from "react";
import { useColorScheme } from "react-native";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DeviceEvents } from "~/devices/queries";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const scheme = useColorScheme();
  return (
    <QueryClientProvider client={queryClient}>
      <DeviceEvents />
      <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerLargeTitle: true }}>
          <Stack.Screen name="index" options={{ title: "Lumen" }} />
        </Stack>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
