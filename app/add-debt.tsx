import { useState } from "react";
import {
  Alert,
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

  const [personInput, setPersonInput] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"them" | "me">("them");
  const [splitEvenly, setSplitEvenly] = useState(false);

  function handleAddPerson() {
    const trimmed = personInput.trim();
    if (!trimmed) return;
    if (people.includes(trimmed)) {
      setPersonInput("");
      return;
    }
    setPeople(prev => [...prev, trimmed]);
    setPersonInput("");
  }

  function handleRemovePerson(name: string) {
    setPeople(prev => prev.filter(p => p !== name));
  }

  function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Invalid amount", "Please enter an amount greater than $0.00.");
      return;
    }
    if (people.length === 0) {
      Alert.alert("No people added", "Add at least one person to this debt.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Missing reason", "Please enter a reason for this debt.");
      return;
    }

    const perPersonAmount = splitEvenly
      ? parsedAmount / (people.length + 1)
      : parsedAmount;

    for (const person of people) {
      addDebt({
        person,
        amount: parseFloat(perPersonAmount.toFixed(2)),
        direction,
        reason: reason.trim(),
      });
    }

    router.back();
  }

  const parsedAmount = parseFloat(amount) || 0;
  const splitAmount = people.length > 0
    ? parsedAmount / (people.length + 1)
    : 0;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add New Debt</Text>
      <Text style={styles.subtitle}>Track money owed between you and others.</Text>

      {/* People */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>People</Text>
        <View style={styles.personInputRow}>
          <TextInput
            style={[styles.input, styles.personInput]}
            placeholder="Name, phone, or @username"
            value={personInput}
            onChangeText={setPersonInput}
            onSubmitEditing={handleAddPerson}
            returnKeyType="done"
          />
          <Pressable style={styles.addPersonButton} onPress={handleAddPerson}>
            <Text style={styles.addPersonText}>Add</Text>
          </Pressable>
        </View>

        {people.length > 0 && (
          <View style={styles.chips}>
            {people.map(p => (
              <View key={p} style={styles.chip}>
                <Text style={styles.chipText}>{p}</Text>
                <Pressable onPress={() => handleRemovePerson(p)} hitSlop={8}>
                  <Text style={styles.chipRemove}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Amount */}
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

      {/* Direction */}
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

        {/* Split Fee Toggle */}
        <Pressable
          style={[styles.splitButton, splitEvenly && styles.splitButtonActive]}
          onPress={() => setSplitEvenly(s => !s)}
        >
          <View style={styles.splitButtonInner}>
            <Text style={[styles.splitButtonText, splitEvenly && styles.splitButtonTextActive]}>
              Split Fee Evenly
            </Text>
            <View style={[styles.toggle, splitEvenly && styles.toggleActive]}>
              <Text style={styles.toggleText}>{splitEvenly ? "ON" : "OFF"}</Text>
            </View>
          </View>
          {splitEvenly && people.length > 0 && parsedAmount > 0 && (
            <Text style={styles.splitPreview}>
              ${splitAmount.toFixed(2)} each ({people.length + 1} people including you)
            </Text>
          )}
        </Pressable>
      </View>

      {/* Reason */}
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

      <Pressable style={styles.saveButton} onPress={handleSave}>
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
  personInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  personInput: {
    flex: 1,
  },
  addPersonButton: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  addPersonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 4,
  },
  chipText: {
    fontSize: 14,
    color: "#1D4ED8",
    fontWeight: "600",
  },
  chipRemove: {
    fontSize: 18,
    color: "#1D4ED8",
    lineHeight: 20,
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
  splitButton: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4,
  },
  splitButtonActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#16A34A",
  },
  splitButtonInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  splitButtonText: {
    fontSize: 16,
    color: "#0F172A",
    fontWeight: "600",
  },
  splitButtonTextActive: {
    color: "#16A34A",
  },
  toggle: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  toggleActive: {
    backgroundColor: "#16A34A",
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  splitPreview: {
    fontSize: 13,
    color: "#16A34A",
    marginTop: 6,
    fontWeight: "500",
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
