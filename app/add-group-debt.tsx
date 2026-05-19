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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";

export default function AddGroupDebtScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { groups, addDebt } = useDebts();

  const resolvedGroupId = Array.isArray(groupId) ? groupId[0] : groupId;
  const group = groups.find(g => g.id === resolvedGroupId);

  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"them" | "me">("them");
  const [splitEvenly, setSplitEvenly] = useState(false);

  if (!group) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Group not found.</Text>
      </View>
    );
  }

  function toggleMember(name: string) {
    setSelected(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }

  function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert("Invalid amount", "Please enter an amount greater than $0.00.");
      return;
    }
    if (selected.length === 0) {
      Alert.alert("No members selected", "Select at least one group member.");
      return;
    }
    if (!reason.trim()) {
      Alert.alert("Missing reason", "Please enter a reason for this debt.");
      return;
    }

    const perPersonAmount = splitEvenly
      ? parsedAmount / (selected.length + 1)
      : parsedAmount;

    for (const person of selected) {
      addDebt({
        person,
        amount: parseFloat(perPersonAmount.toFixed(2)),
        direction,
        reason: reason.trim(),
        groupId: resolvedGroupId,
      });
    }

    router.back();
  }

  const parsedAmount = parseFloat(amount) || 0;
  const splitAmount = selected.length > 0 ? parsedAmount / (selected.length + 1) : 0;

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Add Group Debt</Text>
      <Text style={styles.subtitle}>{group.name}</Text>

      {/* Member selection */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Who is involved?</Text>
        <View style={styles.chips}>
          {group.members.map(m => {
            const isSelected = selected.includes(m.name);
            return (
              <Pressable
                key={m.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleMember(m.name)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {m.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {group.members.length === 0 && (
          <Text style={styles.noMembersText}>
            This group has no members. Add members when editing the group.
          </Text>
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

        {/* Split toggle */}
        <Pressable
          style={[styles.splitButton, splitEvenly && styles.splitButtonActive]}
          onPress={() => setSplitEvenly(s => !s)}
        >
          <View style={styles.splitInner}>
            <Text style={[styles.splitText, splitEvenly && styles.splitTextActive]}>
              Split Fee Evenly
            </Text>
            <View style={[styles.toggle, splitEvenly && styles.toggleActive]}>
              <Text style={styles.toggleText}>{splitEvenly ? "ON" : "OFF"}</Text>
            </View>
          </View>
          {splitEvenly && selected.length > 0 && parsedAmount > 0 && (
            <Text style={styles.splitPreview}>
              ${splitAmount.toFixed(2)} each ({selected.length + 1} people including you)
            </Text>
          )}
        </Pressable>
      </View>

      {/* Reason */}
      <View style={styles.formGroup}>
        <Text style={styles.label}>Reason</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Dinner, hotel, activity, etc."
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
  container: { flex: 1, padding: 20, backgroundColor: "#F8FAFC" },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  notFoundText: { fontSize: 16, color: "#9CA3AF" },
  title: { fontSize: 32, fontWeight: "700", marginTop: 40, color: "#0F172A" },
  subtitle: { fontSize: 16, color: "#64748B", marginBottom: 28 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  chipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#2563EB",
  },
  chipText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  chipTextSelected: { color: "#2563EB" },
  noMembersText: { fontSize: 14, color: "#9CA3AF", fontStyle: "italic" },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  optionButton: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  optionButtonActive: { backgroundColor: "#EFF6FF", borderColor: "#2563EB" },
  optionText: { fontSize: 16, color: "#0F172A", fontWeight: "600" },
  optionTextActive: { color: "#2563EB" },
  splitButton: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 4,
  },
  splitButtonActive: { backgroundColor: "#F0FDF4", borderColor: "#16A34A" },
  splitInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  splitText: { fontSize: 16, color: "#0F172A", fontWeight: "600" },
  splitTextActive: { color: "#16A34A" },
  toggle: { backgroundColor: "#E2E8F0", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  toggleActive: { backgroundColor: "#16A34A" },
  toggleText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  splitPreview: { fontSize: 13, color: "#16A34A", marginTop: 6, fontWeight: "500" },
  saveButton: {
    backgroundColor: "#2563EB",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 40,
  },
  saveButtonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
