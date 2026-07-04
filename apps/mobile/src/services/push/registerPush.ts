import { Platform } from "react-native";
import { apiFetch, isApiConfigured } from "../api/client";

/**
 * Push token registration (Expo push). Loaded lazily so the app also runs in
 * environments without the native notifications module (Expo Go web).
 * Returns the token when registration succeeded.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    const Notifications = await import("expo-notifications");
    const Device = await import("expo-device");

    if (!Device.isDevice) {
      // Simulators can't receive push notifications.
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== "granted") {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== "granted") return null;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Vuqiro",
        importance: Notifications.AndroidImportance.DEFAULT
      });
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;
    if (!token) return null;

    if (isApiConfigured()) {
      await apiFetch("/notifications/push-token", {
        method: "POST",
        body: JSON.stringify({
          token,
          platform: Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web",
          deviceModel: Device.modelName ?? "",
          osVersion: String(Device.osVersion ?? "")
        })
      });
    }
    return token;
  } catch {
    // Missing native module or push service unavailable — degrade silently.
    return null;
  }
}

export async function unregisterPush(token: string): Promise<void> {
  if (!isApiConfigured()) return;
  try {
    await apiFetch("/notifications/push-token", {
      method: "DELETE",
      body: JSON.stringify({ token })
    });
  } catch {
    // best-effort
  }
}
