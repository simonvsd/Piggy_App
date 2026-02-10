import { MarketPriceChart } from "@/components/MarketPriceChart";
import {
  getMarketHistory,
  getSnapshot,
  type MarketHistoryPoint,
} from "@/services/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const COLORS = {
  background: "#f2f2f7",
  card: "#ffffff",
  cardBorder: "#e5e5ea",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
};

export default function PositionDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sym = symbol ?? "";
    if (!sym) {
      setError("No symbol");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getSnapshot();
      const position = snapshot.positions?.find(
        (p) => p.symbol.toUpperCase() === sym.toUpperCase()
      );
      setCurrentPrice(position?.market_price ?? position?.current_price ?? null);

      const historyData = await getMarketHistory(sym).catch(() => []);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (e) {
      console.error("Position detail load error:", e);
      setError("Failed to load data");
      setHistory([]);
      setCurrentPrice(null);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    load();
  }, [load]);

  const displaySymbol = (symbol ?? "").toUpperCase();

  if (loading && history.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backLabel}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.symbolTitle}>{displaySymbol}</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.text} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backLabel}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.symbolTitle}>{displaySymbol}</Text>
        </View>
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backLabel}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.symbolTitle}>{displaySymbol}</Text>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Current price</Text>
          <Text style={styles.priceValue}>
            {currentPrice != null
              ? `$${currentPrice.toFixed(2)}`
              : "—"}
          </Text>
        </View>
        <Text style={styles.sectionTitle}>Price history</Text>
        <MarketPriceChart series={history} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  backBtn: {
    marginRight: 12,
    paddingVertical: 8,
    paddingRight: 8,
  },
  backLabel: {
    fontSize: 17,
    color: "#1e88e5",
  },
  symbolTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  priceCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  priceLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
