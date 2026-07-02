import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CoinsModal } from "./src/components/CoinsModal";
import { ReportModal } from "./src/components/ReportModal";
import { SubscribeModal } from "./src/components/SubscribeModal";
import { CreatorProfileScreen } from "./src/features/creator/CreatorProfileScreen";
import { FeedScreen } from "./src/features/feed/FeedScreen";
import { ProfileScreen } from "./src/features/profile/ProfileScreen";
import { SettingsScreen } from "./src/features/settings/SettingsScreen";
import { UploadScreen } from "./src/features/upload/UploadScreen";
import { WalletScreen } from "./src/features/wallet/WalletScreen";
import { WelcomeScreen } from "./src/features/welcome/WelcomeScreen";
import { colors } from "./src/design/theme";

type Tab = "feed" | "discover" | "upload" | "wallet" | "profile";
type Route = "welcome" | "tabs" | "creator" | "settings";

const tabs: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "feed", label: "Feed", icon: "play-circle" },
  { id: "discover", label: "Discover", icon: "compass" },
  { id: "upload", label: "Create", icon: "add-circle" },
  { id: "wallet", label: "Wallet", icon: "wallet" },
  { id: "profile", label: "Profile", icon: "person" }
];

export default function App() {
  const [route, setRoute] = useState<Route>("welcome");
  const [tab, setTab] = useState<Tab>("feed");
  const [selectedCreatorId, setSelectedCreatorId] = useState("creator_001");
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const openCreator = (creatorId: string) => {
    setSelectedCreatorId(creatorId);
    setRoute("creator");
  };

  let content: React.ReactNode;
  if (route === "welcome") {
    content = <WelcomeScreen onEnter={() => setRoute("tabs")} />;
  } else if (route === "creator") {
    content = <CreatorProfileScreen creatorId={selectedCreatorId} onBack={() => setRoute("tabs")} onSubscribe={() => setSubscribeOpen(true)} onCoins={() => setCoinsOpen(true)} />;
  } else if (route === "settings") {
    content = <SettingsScreen onBack={() => setRoute("tabs")} />;
  } else if (tab === "feed" || tab === "discover") {
    content = <FeedScreen onCreator={openCreator} onSubscribe={() => setSubscribeOpen(true)} onCoins={() => setCoinsOpen(true)} onReport={() => setReportOpen(true)} />;
  } else if (tab === "upload") {
    content = <UploadScreen />;
  } else if (tab === "wallet") {
    content = <WalletScreen onBuy={() => setCoinsOpen(true)} />;
  } else {
    content = <ProfileScreen onSettings={() => setRoute("settings")} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.app}>
        {content}
        {route === "tabs" && (
          <View style={styles.tabBar}>
            {tabs.map((item) => (
              <Pressable key={item.id} style={styles.tabItem} onPress={() => setTab(item.id)}>
                <Ionicons name={item.icon} size={24} color={tab === item.id ? colors.secondary : colors.textMuted} />
                <Text style={[styles.tabLabel, tab === item.id && styles.tabLabelActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <SubscribeModal visible={subscribeOpen} onClose={() => setSubscribeOpen(false)} />
        <CoinsModal visible={coinsOpen} onClose={() => setCoinsOpen(false)} />
        <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  tabBar: { position: "absolute", left: 12, right: 12, bottom: 16, height: 72, borderRadius: 28, backgroundColor: "rgba(16,16,22,0.94)", borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  tabItem: { alignItems: "center", gap: 4 },
  tabLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "800" },
  tabLabelActive: { color: colors.secondary }
});
