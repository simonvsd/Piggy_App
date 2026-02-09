import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

const API_BASE = "http://192.168.0.171:8080"; // <-- replace

type Snapshot = {
  cash: number;
  realized_pnl: number;
  total_equity: number;
};

export default function HomeScreen() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/portfolio/snapshot`)
      .then(res => res.json())
      .then(data => {
        setSnapshot(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("API error:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!snapshot) {
    return <Text>Error loading portfolio</Text>;
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <Text style={{ fontSize: 24, color: "#fff" }}>
        🐷 Piggy Portfolio
      </Text>
  
      <Text style={{ color: "#fff" }}>
        Cash: ${snapshot.cash.toFixed(2)}
      </Text>
  
      <Text style={{ color: "#fff" }}>
        Total Equity: ${snapshot.total_equity.toFixed(2)}
      </Text>
  
      <Text style={{ color: "#fff" }}>
        Realized P&L: ${snapshot.realized_pnl.toFixed(2)}
      </Text>
    </View>
  );  
}
