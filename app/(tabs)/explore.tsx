import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { addCash } from "../../services/api";
import { notifyPortfolioChanged } from "../../services/portfolioEvents";

const COLORS = {
  background: "#f2f2f7",
  card: "#ffffff",
  cardBorder: "#e5e5ea",
  text: "#1c1c1e",
  textSecondary: "#8e8e93",
  inputBg: "#f2f2f7",
  primary: "#1e88e5",
  error: "#ff3b30",
};

export default function PiggyBankScreen() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amountNum = Number(amount);
  const isValid = !Number.isNaN(amountNum) && amountNum > 0;
  const canSubmit = isValid && !loading;

  async function handleAddCash() {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await addCash(amountNum);
      notifyPortfolioChanged();
      setAmount("");
      Alert.alert("Done", `$${amountNum.toFixed(2)} added to your cash balance.`);
    } catch (err: any) {
      const message = err?.message ?? "Failed to add cash";
      setError(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Piggy Bank</Text>
        <Text style={styles.subtitle}>Add cash to your portfolio</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Amount to add ($)</Text>
        <TextInput
          style={[styles.input, amount !== "" && !isValid && styles.inputError]}
          value={amount}
          onChangeText={(t) => {
            setAmount(t);
            setError(null);
          }}
          placeholder="0.00"
          placeholderTextColor={COLORS.textSecondary}
          keyboardType="decimal-pad"
        />
        {amount !== "" && !isValid && (
          <Text style={styles.inlineError}>Enter an amount greater than 0</Text>
        )}
        {error != null && <Text style={styles.inlineError}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleAddCash}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>
            {loading ? "Adding…" : "Add to cash"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
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
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 20,
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
  button: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
});
