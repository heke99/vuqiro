# Push Notifications — Decision & Scaffold

## Decision: Expo Notifications (expo-notifications + Expo Push Service)

Chosen over raw FCM/APNs integration because:

- One API for both platforms; Expo Push Service handles APNs/FCM delivery.
- Works with EAS builds without maintaining native push code.
- Token model fits our schema: the Expo push token is stored in
  `notification_preferences.push_token` via
  `POST /notifications/preferences { pushToken }`.
- Can be replaced by direct FCM/APNs later without schema changes (the token
  column is provider-agnostic).

Trade-off: delivery goes through Expo's push infrastructure. If that becomes
a constraint (compliance/latency), switch to `@react-native-firebase/messaging`
+ APNs keys; only the token registration and the server-side sender change.

## Client flow (activates with a development build)

1. Ask permission via `expo-notifications` (`getPermissionsAsync` /
   `requestPermissionsAsync`) after the user enables the "Push notifications"
   preference.
2. Get the token: `getExpoPushTokenAsync({ projectId })`.
3. Save it: `POST /notifications/preferences { pushEnabled: true, pushToken }`.
4. Expo Go limitation: remote push requires a dev build (SDK 53+); in-app
   inbox works everywhere.

## Server flow (follow-up work)

When creating a notification in `notifyProfile`, if the target has
`push_enabled` and a `push_token`, POST to
`https://exp.host/--/api/v2/push/send` with the title/body. Batch up to 100
messages per request; handle `DeviceNotRegistered` receipts by clearing the
stored token.

## Privacy rules

- Payout amounts and moderation details are summarized, never detailed, in
  push payloads (full detail only in the authenticated in-app inbox).
- Notification preferences are enforced server-side in `notifyProfile` before
  any delivery (in-app or push).
