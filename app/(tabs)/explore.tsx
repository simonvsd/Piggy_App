import { useState } from "react";
import {
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
import { addCash, removeCash } from "../../services/api";
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
  remove: "#ff3b30",
};

export default function PiggyBankScreen() {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [removeAmount, setRemoveAmount] = useState("");
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState(false);

  const amountNum = Number(amount);
  const isValid = !Number.isNaN(amountNum) && amountNum > 0;
  const canSubmit = isValid && !loading;

  const removeAmountNum = Number(removeAmount);
  const isRemoveValid = !Number.isNaN(removeAmountNum) && removeAmountNum > 0;
  const canRemove = isRemoveValid && !removeLoading;

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

  function handleRemovePress() {
    if (!canRemove) return;
    Alert.alert(
      "Are you sure?",
      `Remove $${removeAmountNum.toFixed(2)} from your cash?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: handleRemoveCash,
        },
      ]
    );
  }

  async function handleRemoveCash() {
    if (!canRemove) return;
    setRemoveError(null);
    setRemoveLoading(true);
    try {
      await removeCash(removeAmountNum);
      notifyPortfolioChanged();
      setRemoveAmount("");
      Alert.alert("Done", `$${removeAmountNum.toFixed(2)} removed from your cash.`);
    } catch (err: any) {
      const message = err?.message ?? "Failed to remove cash";
      setRemoveError(message);
      Alert.alert("Error", message);
    } finally {
      setRemoveLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Piggy Bank</Text>
          <Text style={styles.subtitle}>Add or remove cash</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Amount to add ($)</Text>
              <TouchableOpacity
                onPress={Keyboard.dismiss}
                style={styles.doneButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
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
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
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

          <View style={styles.card}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Amount to remove ($)</Text>
              <TouchableOpacity
                onPress={Keyboard.dismiss}
                style={styles.doneButton}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, removeAmount !== "" && !isRemoveValid && styles.inputError]}
              value={removeAmount}
              onChangeText={(t) => {
                setRemoveAmount(t);
                setRemoveError(null);
              }}
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />
            {removeAmount !== "" && !isRemoveValid && (
              <Text style={styles.inlineError}>Enter an amount greater than 0</Text>
            )}
            {removeError != null && <Text style={styles.inlineError}>{removeError}</Text>}

            <TouchableOpacity
              style={[styles.buttonRemove, !canRemove && styles.buttonDisabled]}
              onPress={handleRemovePress}
              disabled={!canRemove}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>
                {removeLoading ? "Removing…" : "Remove from cash"}
              </Text>
            </TouchableOpacity>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  card: {
    marginHorizontal: 20,
    marginBottom: 20,
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
    color: COLORS.primary,
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
  buttonRemove: {
    backgroundColor: COLORS.remove,
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
