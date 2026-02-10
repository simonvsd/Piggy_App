import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { getSnapshot, Position, Snapshot } from "../../services/api";
import { subscribePortfolioChanged } from "../../services/portfolioEvents";

const DEBUG = false;

export default function HomeScreen() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (DEBUG) console.log("[Home] load() started");
    try {
      setLoading(true);
      const data = await getSnapshot();
      if (DEBUG) console.log("[Home] load() completed", { cash: data.cash, positionsCount: data.positions?.length });
      setSnapshot(data);
    } catch (err) {
      console.error("[Home] load error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (DEBUG) console.log("[Home] mount");
    return () => {
      if (DEBUG) console.log("[Home] unmount");
    };
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const unsub = subscribePortfolioChanged(() => {
      if (DEBUG) console.log("[Home] portfolioChanged received, refreshing");
      load();
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!snapshot) {
    return <Text>Error loading portfolio</Text>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🐷 Piggy Portfolio</Text>

      <Text style={styles.text}>Cash: ${snapshot.cash.toFixed(2)}</Text>
      <Text style={styles.text}>Total Equity: ${snapshot.total_equity.toFixed(2)}</Text>
      <Text style={styles.text}>Realized P&L: ${snapshot.realized_pnl.toFixed(2)}</Text>

      <Text style={[styles.text, { marginTop: 20, fontSize: 20 }]}>Positions</Text>

      <FlatList
        data={snapshot.positions}
        keyExtractor={(p) => p.symbol}
        renderItem={({ item }) => <PositionRow p={item} />}
      />
    </View>
  );
}

function PositionRow({ p }: { p: Position }) {
  return (
    <View style={styles.row}>
      <Text style={styles.text}>{p.symbol}</Text>
      <Text style={styles.text}>Qty: {p.quantity}</Text>
      <Text style={styles.text}>PnL: ${p.unrealized_pnl.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    color: "#fff",
    textAlign: "center",
  },
  text: {
    color: "#fff",
    marginVertical: 4,
  },
  row: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
});
