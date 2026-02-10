import { MarketPriceChart } from "@/components/MarketPriceChart";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  getMarketHistory,
  getSnapshot,
  placeTrade,
  type MarketHistoryPoint,
} from "../../services/api";
import { notifyPortfolioChanged } from "../../services/portfolioEvents";


const COLORS = {
  background: "#B0C4DE",
  card: "#ffffff",
  cardBorder: "#black",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
  inputBg: "#f2f2f7",
  error: "#ff3b30",
};

export default function TradeScreen() {
  const [symbol, setSymbol] = useState("AAPL");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const lastKnownPricesRef = useRef<Record<string, number>>({});

  const loadPrice = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setCurrentPrice(null);
      return;
    }
    setPriceLoading(true);
    try {
      const snapshot = await getSnapshot();
      const position = snapshot.positions?.find(
        (p) => symbol.toUpperCase() === sym
      );
      if (position != null) {
        lastKnownPricesRef.current[sym] = position.current_price;
        setCurrentPrice(position.current_price);
      } else {
        setCurrentPrice(lastKnownPricesRef.current[sym] ?? null);
      }
    } catch {
      setCurrentPrice(lastKnownPricesRef.current[sym] ?? null);
    } finally {
      setPriceLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    const sym = symbol.trim().toUpperCase();
    if (sym && lastKnownPricesRef.current[sym] != null) {
      setCurrentPrice(lastKnownPricesRef.current[sym]);
    }
  }, [symbol]);

  useEffect(() => {
    loadPrice();
  }, [loadPrice]);

  const loadHistory = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) {
      setHistory([]);
      return;
    }
    const historyData = await getMarketHistory(sym).catch(() => []);
    setHistory(Array.isArray(historyData) ? historyData : []);
  }, [symbol]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const qtyNum = Number(quantity);
  const isValidQty = !Number.isNaN(qtyNum) && qtyNum > 0;
  const canSubmit = isValidQty;

  const lastCloseFromHistory =
    history.length > 0
      ? [...history].sort((a, b) => a.timestamp - b.timestamp)[history.length - 1]?.close ?? null
      : null;
  const displayPrice = history.length > 0 ? (currentPrice ?? lastCloseFromHistory) : null;

  function confirmTrade(side: "BUY" | "SELL") {
    if (!canSubmit) return;
    const sym = symbol.trim().toUpperCase() || "—";
    const total = displayPrice != null ? (displayPrice * qtyNum).toFixed(2) : "—";
    const message =
      side === "BUY"
        ? `Buy ${qtyNum} share${qtyNum !== 1 ? "s" : ""} of ${sym}?${displayPrice != null ? `\nTotal: $${total}` : ""}`
        : `Sell ${qtyNum} share${qtyNum !== 1 ? "s" : ""} of ${sym}?`;
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
    if (!canSubmit) return;
    setError(null);
    try {
      const result = await placeTrade(symbol, side, qtyNum);
      notifyPortfolioChanged();
      Alert.alert("Success", JSON.stringify(result, null, 2));
    } catch (err: any) {
      const message = err?.message ?? "Trade failed";
      setError(message);
      Alert.alert("Error", message);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Trade</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
        <View style={styles.card}>
          <Text style={styles.label}>Symbol</Text>
          <TextInput
          style={[styles.input, history.length > 0 && styles.symbolInputValid]}
          value={symbol}
          onChangeText={(t) => {
            setSymbol(t);
            setError(null);
          }}
          placeholder="e.g. AAPL"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"

          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
          blurOnSubmit={true}
        />


        <View style={styles.priceRow}>
          <View style={styles.priceLabelRow}>
            <Text style={styles.priceLabel}>
              Current {symbol.trim() || "—"} Price:{" "}
            </Text>
            {priceLoading ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : history.length === 0 ? (
              <Text style={styles.priceUnavailable}>Not available</Text>
            ) : displayPrice != null ? (
              <Text style={styles.priceValue}>${displayPrice.toFixed(2)}</Text>
            ) : (
              <Text style={styles.priceUnavailable}>Not available</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshPriceButton}
            onPress={loadPrice}
            disabled={priceLoading}
            activeOpacity={0.8}
          >
            <Text style={styles.refreshPriceButtonText}>Refresh Price</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.labelRow}>
          <View style={styles.labelWithTotal}>
            <Text style={styles.label}>Quantity</Text>
            {history.length > 0 && displayPrice != null && isValidQty && (
              <Text style={styles.totalLabel}>
              {" "} (${(displayPrice * qtyNum).toFixed(2)})
            </Text>            
            )}
          </View>
          <TouchableOpacity
            onPress={Keyboard.dismiss}
            style={styles.doneButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneButtonText}></Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.input, !isValidQty && quantity !== "" && styles.inputError]}
          value={quantity}
          onChangeText={(t) => {
            setQuantity(t);
            setError(null);
          }}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={COLORS.textSecondary}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
        {quantity !== "" && !isValidQty && (
          <Text style={styles.inlineError}>Quantity must be greater than 0</Text>
        )}

        {error != null && <Text style={styles.inlineError}>{error}</Text>}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, styles.buyButton, !canSubmit && styles.buttonDisabled]}
          onPress={() => confirmTrade("BUY")}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.buyButtonText}>BUY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.sellButton, !canSubmit && styles.buttonDisabled]}
          onPress={() => confirmTrade("SELL")}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.sellButtonText}>SELL</Text>
        </TouchableOpacity>
      </View>

      {symbol.trim() !== "" && (
        <>
          <Text style={styles.sectionTitle}>{symbol.trim().toUpperCase() || "—"} Price history</Text>
          <MarketPriceChart series={history} />
        </>
      )}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 200,
  },
  header: {
    alignItems: "center",
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.text,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  label: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.text,
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelWithTotal: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,  // makes it grey
    lineHeight: 24,               // increases vertical height only
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
  priceRow: {
    marginBottom: 16,
  },
  priceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  priceUnavailable: {
    fontSize: 15,
    color: COLORS.error,
    fontStyle: "italic",
  },
  refreshPriceButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  refreshPriceButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    color: COLORS.text,
    padding: 14,
    borderRadius: 10,
    fontSize: 17,
    marginBottom: 16,
  },
  symbolInputValid: {
    fontWeight: "700",
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
  buttons: {
    paddingHorizontal: 20,
    marginBottom: 10,   // <-- ADD THIS
  },
  button: {
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
    marginBottom: 12,
  },
  sellButton: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
  },
  buyButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  sellButtonText: {
    color: "#000",
    fontSize: 17,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: COLORS.text,
    marginHorizontal: 20,
    marginBottom: 12,
    marginTop: 24,
  },
});
