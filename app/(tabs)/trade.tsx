import { MarketPriceChart } from "@/components/MarketPriceChart";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  getSymbolList,
  loadSymbol,
  placeTrade,
  type MarketHistoryPoint,
  type SymbolOption,
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

const DROPDOWN_MAX_ITEMS = 5;

const DropdownItem = React.memo(function DropdownItem({
  item,
  isLast,
  onSelect,
}: {
  item: SymbolOption;
  isLast: boolean;
  onSelect: (item: SymbolOption) => void;
}) {
  const onPress = useCallback(() => onSelect(item), [item, onSelect]);
  return (
    <TouchableOpacity
      style={[dropdownItemStyles.item, isLast && dropdownItemStyles.itemLast]}
      onPress={onPress}
    >
      <Text style={dropdownItemStyles.text}>
        {item.symbol} ({item.name})
      </Text>
    </TouchableOpacity>
  );
});

function makeDropdownItemStyles(colors: typeof COLORS) {
  return StyleSheet.create({
    item: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
    },
    itemLast: { borderBottomWidth: 0 },
    text: { fontSize: 15, color: colors.text },
  });
}
const dropdownItemStyles = makeDropdownItemStyles(COLORS);

export default function TradeScreen() {
  const [symbolInput, setSymbolInput] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<SymbolOption | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [history, setHistory] = useState<MarketHistoryPoint[]>([]);
  const [symbolList, setSymbolList] = useState<SymbolOption[]>([]);

  const symbolForApi = useMemo(
    () => (selectedSymbol?.symbol ?? symbolInput).trim(),
    [selectedSymbol?.symbol, symbolInput]
  );

  const loadPrice = useCallback(async () => {
    const sym = (selectedSymbol?.symbol ?? symbolInput).trim();
    if (!sym) {
      setCurrentPrice(null);
      return;
    }
    setPriceLoading(true);
    try {
      const data = await getMarketHistory(sym);
      if (Array.isArray(data) && data.length > 0) {
        const latest = data[data.length - 1];
        setCurrentPrice(latest.close);
      } else {
        setCurrentPrice(null);
      }
    } catch {
      setCurrentPrice(null);
    } finally {
      setPriceLoading(false);
    }
  }, [selectedSymbol?.symbol, symbolInput]);

  useEffect(() => {
    loadPrice();
  }, [loadPrice]);

  const loadHistory = useCallback(async () => {
    const sym = (selectedSymbol?.symbol ?? symbolInput).trim();
    if (!sym) {
      setHistory([]);
      return;
    }
    try {
      await loadSymbol(sym).catch(() => {});
      const data = await getMarketHistory(sym);
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  }, [selectedSymbol?.symbol, symbolInput]);
  

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    getSymbolList().then((list) => {
      setSymbolList(list);
    });
  }, []);

  const searchQuery = symbolInput.trim().toLowerCase();
  const filteredSymbols = useMemo(
    () =>
      searchQuery
        ? symbolList.filter(
            (item) =>
              item.symbol.toLowerCase().includes(searchQuery) ||
              item.name.toLowerCase().includes(searchQuery)
          )
        : [],
    [symbolList, searchQuery]
  );
  const dropdownOptions = useMemo(
    () => filteredSymbols.slice(0, DROPDOWN_MAX_ITEMS),
    [filteredSymbols]
  );
  const showDropdown = useMemo(
    () =>
      symbolInput.trim().length > 0 &&
      dropdownOptions.length > 0 &&
      (selectedSymbol == null ||
        symbolInput !== `${selectedSymbol.symbol} (${selectedSymbol.name})`),
    [symbolInput, dropdownOptions.length, selectedSymbol]
  );

  const handleSymbolSelect = useCallback((item: SymbolOption) => {
    setSelectedSymbol(item);
    setSymbolInput(`${item.symbol} (${item.name})`);
  }, []);

  const handleSymbolChangeText = useCallback(
    (t: string) => {
      setSymbolInput(t);
      setError(null);
      if (
        selectedSymbol &&
        t !== `${selectedSymbol.symbol} (${selectedSymbol.name})`
      ) {
        setSelectedSymbol(null);
      }
    },
    [selectedSymbol]
  );

  const qtyNum = Number(quantity);
  const isValidQty =
    !Number.isNaN(qtyNum) && qtyNum > 0 && Number.isInteger(qtyNum);
  const canSubmit = symbolForApi.length > 0 && isValidQty;

  const lastCloseFromHistory =
    history.length > 0
      ? [...history].sort((a, b) => a.timestamp - b.timestamp)[history.length - 1]?.close ?? null
      : null;
  const displayPrice = history.length > 0 ? (currentPrice ?? lastCloseFromHistory) : null;

  function confirmTrade(side: "BUY" | "SELL") {
    if (!canSubmit) return;
    const sym = symbolForApi;
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
      const result = await placeTrade(symbolForApi, side, qtyNum);
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
            value={symbolInput}
            onChangeText={handleSymbolChangeText}
            placeholder="e.g. AAPL"
            placeholderTextColor={COLORS.textSecondary}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          {showDropdown && (
            <View style={styles.dropdown}>
              {dropdownOptions.map((item, index) => (
                <DropdownItem
                  key={item.symbol}
                  item={item}
                  isLast={index === dropdownOptions.length - 1}
                  onSelect={handleSymbolSelect}
                />
              ))}
            </View>
          )}

        <View style={styles.priceRow}>
          <View style={styles.priceLabelRow}>
            <Text style={styles.priceLabel}>
              Current {symbolForApi || "—"} Price:{" "}
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
          <Text style={styles.inlineError}>
            Quantity must be a whole number (e.g. 1, 2, 3)
          </Text>
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

      {symbolForApi !== "" && (
        <>
          <Text style={styles.sectionTitle}>{symbolForApi} Price history</Text>
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
  symbolRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  chooseSymbolButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chooseSymbolButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
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
  symbolInputTouchable: {
    justifyContent: "center",
  },
  symbolInputText: {
    fontSize: 17,
    color: COLORS.text,
  },
  symbolInputPlaceholder: {
    color: COLORS.textSecondary,
  },
  symbolInputValid: {
    fontWeight: "700",
  },
  dropdown: {
    marginTop: -8,
    marginBottom: 8,
    borderRadius: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: "hidden",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
  },
  modalClose: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
  },
  modalSearch: {
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    fontSize: 16,
    color: COLORS.text,
  },
  symbolList: {
    maxHeight: 400,
  },
  symbolItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  symbolItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.text,
  },
  symbolListEmpty: {
    padding: 24,
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});
