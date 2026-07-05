import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { mockWallet, mockWalletTransactions } from "@vuqiro/mock-data";
import type { WalletTransaction } from "@vuqiro/types";
import { Card } from "../../components/Card";
import { CoinPackCard } from "../../components/CoinPackCard";
import { Screen } from "../../components/Screen";
import { apiFetch, isApiConfigured } from "../../services/api/client";
import { isDemoMode } from "../../services/data/demoMode";
import { colors, spacing } from "../../design/theme";

type WalletResponse = {
  wallet?: { coinBalance?: number; coin_balance?: number };
  transactions?: (WalletTransaction | { id: string; label?: string; type?: string; amount: number })[];
  source: string;
};

export function WalletScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(isDemoMode() ? mockWallet.coinBalance : 0);
  const [transactions, setTransactions] = useState<{ id: string; label: string; amount: number }[]>(
    isDemoMode() ? mockWalletTransactions.map((tx) => ({ id: tx.id, label: tx.label, amount: tx.amount })) : []
  );
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isApiConfigured()) return;
      try {
        const response = await apiFetch<WalletResponse>("/wallet");
        if (cancelled) return;
        const coinBalance = response.wallet?.coinBalance ?? response.wallet?.coin_balance;
        if (typeof coinBalance === "number") setBalance(coinBalance);
        if (response.transactions) {
          setTransactions(
            response.transactions.map((tx) => ({
              id: String(tx.id),
              label: ("label" in tx && tx.label) || ("type" in tx && tx.type) || "Transaction",
              amount: tx.amount
            }))
          );
        }
        setIsLive(response.source === "db");
      } catch {
        // keep the demo wallet visible
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const onBuy = () => router.push("/modals/coins");
  return (
    <Screen>
      <Text style={styles.kicker}>Wallet</Text>
      <Text style={styles.title}>Your coins</Text>
      <Card style={styles.balanceCard}>
        <Text style={styles.balance}>{balance.toLocaleString()}</Text>
        <Text style={styles.balanceLabel}>Available coins{isLive ? "" : " (demo)"}</Text>
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
      {transactions.length === 0 ? <Text style={styles.note}>No transactions yet.</Text> : null}
      {transactions.map((tx) => (
        <Card key={tx.id} style={styles.txn}>
          <Text style={styles.txnLabel}>{tx.label}</Text>
          <Text style={[styles.txnAmount, tx.amount < 0 && styles.negative]}>
            {tx.amount > 0 ? "+" : ""}
            {tx.amount}
          </Text>
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
