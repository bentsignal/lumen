import { requireOptionalNativeModule } from "expo-modules-core";
import { deviceError, type Connection } from "./model";

type LAN = {
  addListener(
    name: "hueEvent",
    listener: (event: {
      state: string;
      data?: string;
      generation: string;
    }) => void,
  ): { remove(): void };
  probe(connection: Connection): Promise<{ fingerprint: string }>;
  request(
    connection: Connection,
    path: string,
    method: string,
    body: string,
  ): Promise<string>;
  startEvents(connection: Connection, generation: string): void;
  stopEvents(): void;
};

const native = requireOptionalNativeModule<LAN>("LumenLAN");
export function lan(): LAN {
  if (!native)
    throw new Error(
      "Install the Lumen development build to connect local devices. Expo Go does not include its certificate trust module.",
    );
  return native;
}
export async function probeBridge(connection: Connection) {
  try {
    return await lan().probe(connection);
  } catch (error) {
    throw deviceError(error);
  }
}
export async function request<T>(
  connection: Connection,
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  let result: string;
  try {
    result = await lan().request(
      connection,
      path,
      method,
      body ? JSON.stringify(body) : "",
    );
  } catch (error) {
    throw deviceError(error);
  }
  try {
    return JSON.parse(result) as T;
  } catch {
    throw new Error("The device returned an unreadable response.");
  }
}
