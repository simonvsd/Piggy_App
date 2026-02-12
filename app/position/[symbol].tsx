import { MarketPriceChart } from "@/components/MarketPriceChart";
import {
  getMarketHistory,
  getSnapshot,
  placeTrade,
  type MarketHistoryPoint,
} from "@/services/api";
import { notifyPortfolioChanged } from "@/services/portfolioEvents";
import { formatQuantity } from "@/utils/format";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const COLORS = {
  background: "#f2f2f7",
  card: "#ffffff",
  cardBorder: "#e5e5ea",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
  inputBg: "#f2f2f7",
  error: "#ff3b30",
};

export default function PositionDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const router = useRouter();
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [positionQuantity, setPositionQuantity] = useState(0);

  const load = useCallback(async () => {
    const sym = (symbol ?? "").trim();
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
      setPositionQuantity(position?.quantity ?? 0);

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
  const sym = (symbol ?? "").trim().toUpperCase();
  const qtyNum = Number(quantity);
  const isValidQty =
    !Number.isNaN(qtyNum) && qtyNum > 0 && Number.isInteger(qtyNum);
  const lastCloseFromHistory =
    history.length > 0
      ? [...history].sort((a, b) => a.timestamp - b.timestamp)[history.length - 1]?.close ?? null
      : null;
  const displayPrice = currentPrice ?? lastCloseFromHistory;
  const canSubmit = isValidQty && !tradeLoading;

  function confirmTrade(side: "BUY" | "SELL") {
    if (!canSubmit) return;
    const total = displayPrice != null ? (displayPrice * qtyNum).toFixed(2) : "—";
    const message =
      side === "BUY"
        ? `Buy ${qtyNum} share${qtyNum !== 1 ? "s" : ""} of ${displaySymbol}?${displayPrice != null ? `\nTotal: $${total}` : ""}`
        : `Sell ${qtyNum} share${qtyNum !== 1 ? "s" : ""} of ${displaySymbol}?`;
    Alert.alert(
      "Confirm",
      message,
      [
        { text: "Cancel", style: "cancel" },
        { text: side === "BUY" ? "Buy" : "Sell", onPress: () => submit(side) },
      ]
    );
  }

  async function submit(side: "BUY" | "SELL") {
    if (!canSubmit || !sym) return;
    setTradeError(null);
    setTradeLoading(true);
    try {
      const result = await placeTrade(sym, side, qtyNum);
      notifyPortfolioChanged();
      await load();
      Alert.alert("Success", JSON.stringify(result, null, 2));
    } catch (err: any) {
      const message = err?.message ?? "Trade failed";
      setTradeError(message);
      Alert.alert("Error", message);
    } finally {
      setTradeLoading(false);
    }
  }

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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
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
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Current price</Text>
            {displayPrice != null ? (
              <Text style={styles.priceValue}>${displayPrice.toFixed(2)}</Text>
            ) : (
              <>
                <Text style={styles.priceUnavailable}>Not available</Text>
                {!loading && history.length === 0 && (
                  <Text style={styles.priceUnavailableHint}>
                    No price history for this symbol from the data provider.
                  </Text>
                )}
              </>
            )}
          </View>

          <Text style={styles.sectionTitle}>Price history</Text>
          <MarketPriceChart series={history} />

          <Text style={styles.sectionTitle}>Buy or sell</Text>
          <View style={styles.tradeCard}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Quantity</Text>
              {positionQuantity > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setQuantity(formatQuantity(positionQuantity));
                    setTradeError(null);
                    Keyboard.dismiss();
                  }}
                  style={styles.sellAllButton}
                >
                  <Text style={styles.sellAllButtonText}>
                    Sell all ({formatQuantity(positionQuantity)})
                  </Text>
                </TouchableOpacity>
              )}
              {positionQuantity <= 0 && (
                <TouchableOpacity onPress={Keyboard.dismiss} style={styles.doneButton}>
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, quantity !== "" && !isValidQty && styles.inputError]}
              value={quantity}
              onChangeText={(t) => {
                setQuantity(t);
                setTradeError(null);
              }}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={COLORS.textSecondary}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            {quantity !== "" && !isValidQty && (
              <Text style={styles.inlineError}>
                Quantity must be a whole number (e.g. 1, 2, 3)
              </Text>
            )}
            {tradeError != null && <Text style={styles.inlineError}>{tradeError}</Text>}
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={[styles.tradeButton, styles.buyButton, !canSubmit && styles.buttonDisabled]}
                onPress={() => confirmTrade("BUY")}
                disabled={!canSubmit}
                activeOpacity={0.8}
              >
                <Text style={styles.tradeButtonText}>BUY</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tradeButton, styles.sellButton, !canSubmit && styles.buttonDisabled]}
                onPress={() => confirmTrade("SELL")}
                disabled={!canSubmit}
                activeOpacity={0.8}
              >
                <Text style={[styles.tradeButtonText, styles.sellButtonText]}>SELL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
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
  priceUnavailable: {
    fontSize: 18,
    color: COLORS.textSecondary,
  },
  priceUnavailableHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  tradeCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
  },
  doneButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  sellAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sellAllButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#c62828",
  },
  input: {
    backgroundColor: COLORS.inputBg,
    color: COLORS.text,
    padding: 14,
    borderRadius: 10,
    fontSize: 17,
    marginBottom: 16,
  },
  inputError: {
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  inlineError: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: -8,
    marginBottom: 8,
  },
  buttonsRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  tradeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buyButton: {
    backgroundColor: "#000",
    marginRight: 6,
  },
  sellButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
  },
  tradeButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  sellButtonText: {
    color: "#000",
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
