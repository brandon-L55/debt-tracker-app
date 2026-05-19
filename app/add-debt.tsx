import { useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";

export default function AddDebtScreen() {
  const router = useRouter();
  const { addDebt } = useDebts();
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"them" | "me">("them");

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Add New Debt</Text>
      <Text style={styles.subtitle}>
        Track money owed between you and someone else.
      </Text>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Person</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter name, phone, or username"
          value={person}
          onChangeText={setPerson}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Amount</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Who owes who?</Text>

        <Pressable
          style={[styles.optionButton, direction === "them" && styles.optionButtonActive]}
          onPress={() => setDirection("them")}
        >
          <Text style={[styles.optionText, direction === "them" && styles.optionTextActive]}>
            They owe me
          </Text>
        </Pressable>

        <Pressable
          style={[styles.optionButton, direction === "me" && styles.optionButtonActive]}
          onPress={() => setDirection("me")}
        >
          <Text style={[styles.optionText, direction === "me" && styles.optionTextActive]}>
            I owe them
          </Text>
        </Pressable>
      </View>

      <View style={styles.formGroup}>
        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Dinner, tickets, Uber, rent, etc."
          multiline
          value={reason}
          onChangeText={setReason}
        />
      </View>

      <Pressable
        style={styles.saveButton}
        onPress={() => {
          if (!person.trim() || !amount.trim()) return;
          addDebt({
            person: person.trim(),
            amount: parseFloat(amount),
            direction,
            reason: reason.trim(),
          });
          router.back();
        }}
      >
        <Text style={styles.saveButtonText}>Save Debt</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#F8FAFC",
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginTop: 40,
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 16,
    color: "#64748B",
    marginBottom: 28,
  },
  formGroup: {
    marginBottom: 22,
  },
  label: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  optionButton: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  optionButtonActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  optionText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  optionTextActive: {
    color: "#2563EB",
  },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
});
