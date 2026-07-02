import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { mockWalletTransactions } from "@vuqiro/mock-data";
import { Card } from "../../components/Card";
import { CoinPackCard } from "../../components/CoinPackCard";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../design/theme";

export function WalletScreen({ onBuy }: { onBuy: () => void }) {
  return (
    <Screen>
      <Text style={styles.kicker}>Wallet</Text>
      <Text style={styles.title}>Your coins</Text>
      <Card style={styles.balanceCard}>
        <Text style={styles.balance}>1,250</Text>
        <Text style={styles.balanceLabel}>Available coins</Text>
        <Text style={styles.note}>Use coins to support creators, unlock videos and boost content.</Text>
      </Card>
      <Text style={styles.sectionTitle}>Coin packs</Text>
      <View style={styles.grid}>
        <CoinPackCard coins={100} price="$1.99" onPress={onBuy} />
        <CoinPackCard coins={500} bonus={25} price="$7.99" onPress={onBuy} />
        <CoinPackCard coins={1200} bonus={100} price="$14.99" onPress={onBuy} />
        <CoinPackCard coins={5000} bonus={700} price="$49.99" onPress={onBuy} />
      </View>
      <Text style={styles.sectionTitle}>Recent activity</Text>
      {mockWalletTransactions.map((tx) => (
        <Card key={tx.id} style={styles.txn}>
          <Text style={styles.txnLabel}>{tx.label}</Text>
          <Text style={[styles.txnAmount, tx.amount < 0 && styles.negative]}>{tx.amount > 0 ? "+" : ""}{tx.amount}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { color: colors.secondary, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.4 },
  title: { color: colors.text, fontSize: 34, fontWeight: "900", marginBottom: spacing.lg },
  balanceCard: { marginBottom: spacing.xl },
  balance: { color: colors.text, fontSize: 48, fontWeight: "900" },
  balanceLabel: { color: colors.textMuted, marginBottom: spacing.md },
  note: { color: colors.textSoft, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginBottom: spacing.md, marginTop: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: "4%" },
  txn: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  txnLabel: { color: colors.text, fontWeight: "700" },
  txnAmount: { color: colors.success, fontWeight: "900" },
  negative: { color: colors.warning }
});
