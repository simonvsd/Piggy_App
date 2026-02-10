import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { getSnapshot, placeTrade } from "../../services/api";
import { notifyPortfolioChanged } from "../../services/portfolioEvents";

const COLORS = {
  background: "#f2f2f7",
  card: "#ffffff",
  cardBorder: "#e5e5ea",
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

  const qtyNum = Number(quantity);
  const isValidQty = !Number.isNaN(qtyNum) && qtyNum > 0;
  const canSubmit = isValidQty;

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

        <View style={styles.card}>
          <Text style={styles.label}>Symbol</Text>
        <TextInput
          style={styles.input}
          value={symbol}
          onChangeText={(t) => {
            setSymbol(t);
            setError(null);
          }}
          placeholder="e.g. AAPL"
          placeholderTextColor={COLORS.textSecondary}
          autoCapitalize="characters"
        />

        <View style={styles.priceRow}>
          <View style={styles.priceLabelRow}>
            <Text style={styles.priceLabel}>
              Current {symbol.trim() || "—"} Price:{" "}
            </Text>
            {priceLoading ? (
              <ActivityIndicator size="small" color={COLORS.textSecondary} />
            ) : currentPrice != null ? (
              <Text style={styles.priceValue}>${currentPrice.toFixed(2)}</Text>
            ) : (
              <Text style={styles.priceUnavailable}>Price unavailable</Text>
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
          <Text style={styles.label}>Quantity</Text>
          <TouchableOpacity
            onPress={Keyboard.dismiss}
            style={styles.doneButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.doneButtonText}>Done</Text>
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
          onPress={() => submit("BUY")}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.buyButtonText}>BUY</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.sellButton, !canSubmit && styles.buttonDisabled]}
          onPress={() => submit("SELL")}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.sellButtonText}>SELL</Text>
        </TouchableOpacity>
      </View>
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
    paddingTop: 48,
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
});
