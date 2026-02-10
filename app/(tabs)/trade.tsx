import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { placeTrade } from "../../services/api";
import { notifyPortfolioChanged } from "../../services/portfolioEvents";

export default function TradeScreen() {
  const [symbol, setSymbol] = useState("AAPL");
  const [quantity, setQuantity] = useState("1");

  async function submit(side: "BUY" | "SELL") {
    try {
      const result = await placeTrade(symbol, side, Number(quantity));
      notifyPortfolioChanged();
      Alert.alert("Success", JSON.stringify(result, null, 2));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Symbol</Text>

      <TextInput
        style={styles.input}
        value={symbol}
        onChangeText={setSymbol}
      />

      <Text style={styles.text}>Quantity</Text>

      <TextInput
        style={styles.input}
        value={quantity}
        onChangeText={setQuantity}
        keyboardType="numeric"
      />

      <TouchableOpacity style={styles.buyButton} onPress={() => submit("BUY")}>
        <Text style={styles.buttonText}>BUY</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.sellButton} onPress={() => submit("SELL")}>
        <Text style={styles.buttonText}>SELL</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#000",
  },
  text: {
    color: "#fff",
    marginVertical: 8,
  },
  input: {
    backgroundColor: "#222",
    color: "#fff",
    padding: 10,
    marginBottom: 10,
    borderRadius: 6,
  },
  buyButton: {
    backgroundColor: "#2e7d32",
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
  },
  sellButton: {
    backgroundColor: "#c62828",
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});
