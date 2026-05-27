import { useState } from "react";
import { Alert, InputAccessoryView, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { useGroups } from "@/context/GroupsContext";
import { useTheme } from "@/context/ThemeContext";
import { GradientButton } from "@/components/GradientButton";

function parseDeadlineInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parts = trimmed.split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (!m || !d || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime()) || date.getMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function previewDeadline(input: string): string | null {
  const iso = parseDeadlineInput(input);
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function AddGroupDebtScreen() {
  const router = useRouter();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { addDebt } = useDebts();
  const { groups } = useGroups();
  const { colors: t } = useTheme();

  const resolvedGroupId = Array.isArray(groupId) ? groupId[0] : groupId;
  const group = groups.find(g => g.id === resolvedGroupId);

  const [selected, setSelected] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"them" | "me" | null>(null);
  const [splitEvenly, setSplitEvenly] = useState(false);
  const [deadline, setDeadline] = useState("");

  if (!group) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.bg }}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Group not found.</Text>
      </View>
    );
  }

  function toggleMember(name: string) {
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  }

  function handleSave() {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) { Alert.alert("Invalid amount", "Please enter an amount greater than $0.00."); return; }
    if (selected.length === 0) { Alert.alert("No members selected", "Select at least one group member."); return; }
    if (!direction) { Alert.alert("No direction selected", "Choose who owes who before saving."); return; }
    let deadlineISO: string | null = null;
    if (deadline.trim()) {
      deadlineISO = parseDeadlineInput(deadline);
      if (!deadlineISO) { Alert.alert("Invalid date", "Enter the deadline as MM/DD/YYYY or leave it blank."); return; }
    }

    const perPersonAmount = splitEvenly ? parsedAmount / (selected.length + 1) : parsedAmount;
    for (const person of selected) {
      addDebt({ person, amount: parseFloat(perPersonAmount.toFixed(2)), direction, reason: reason.trim(), groupId: resolvedGroupId, deadline: deadlineISO });
    }
    router.back();
  }

  const parsedAmount = parseFloat(amount) || 0;
  const splitAmount = selected.length > 0 ? parsedAmount / (selected.length + 1) : 0;
  const deadlinePreview = previewDeadline(deadline);

  const ACCESSORY_AMOUNT = "add-group-debt-amount";
  const ACCESSORY_REASON = "add-group-debt-reason";
  const ACCESSORY_DEADLINE = "add-group-debt-deadline";

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>
      <Text style={[styles.title, { color: t.text }]}>Add Group Debt</Text>
      <Text style={[styles.subtitle, { color: t.textSub }]}>{group.name}</Text>

      {/* Members */}
      <View style={styles.formGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: t.text, marginBottom: 0 }]}>Who is involved?</Text>
          {group.members.length > 0 && (
            <Pressable hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} onPress={() => {
              const allSelected = group.members.every(m => selected.includes(m.name));
              setSelected(allSelected ? [] : group.members.map(m => m.name));
            }}>
              <Text style={[styles.selectAllText, { color: t.primary }]}>
                {group.members.every(m => selected.includes(m.name)) ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          )}
        </View>
        <View style={styles.chips}>
          {group.members.map(m => {
            const sel = selected.includes(m.name);
            return (
              <Pressable
                key={m.id}
                style={[styles.chip, { backgroundColor: sel ? t.primarySoft : t.card, borderColor: sel ? t.primary : t.border }]}
                onPress={() => toggleMember(m.name)}
              >
                <Text style={[styles.chipText, { color: sel ? t.primary : t.textSub }]}>{m.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {group.members.length === 0 && <Text style={[styles.noMembers, { color: t.textMuted }]}>No members. Edit the group to add members.</Text>}
      </View>

      {/* Amount */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Amount</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          inputAccessoryViewID={ACCESSORY_AMOUNT}
          placeholder="0.00"
          placeholderTextColor={t.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      {/* Direction */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Who owes who?</Text>
        {(["them", "me"] as const).map(opt => (
          <Pressable
            key={opt}
            style={[styles.optionBtn, { backgroundColor: direction === opt ? t.primarySoft : t.card, borderColor: direction === opt ? t.primary : t.border }, { marginBottom: 10 }]}
            onPress={() => setDirection(prev => prev === opt ? null : opt)}
          >
            <Text style={[styles.optionText, { color: direction === opt ? t.primary : t.text }]}>
              {opt === "them" ? "They owe me" : "I owe them"}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[styles.splitBtn, { backgroundColor: splitEvenly ? t.greenSoft : t.card, borderColor: splitEvenly ? t.green : t.border }]}
          onPress={() => setSplitEvenly(s => !s)}
        >
          <View style={styles.splitInner}>
            <Text style={[styles.splitText, { color: splitEvenly ? t.green : t.text }]}>Split Fee Evenly</Text>
            <View style={[styles.toggle, { backgroundColor: splitEvenly ? t.green : t.border }]}>
              <Text style={styles.toggleText}>{splitEvenly ? "ON" : "OFF"}</Text>
            </View>
          </View>
          {splitEvenly && selected.length > 0 && parsedAmount > 0 && (
            <Text style={[styles.splitPreview, { color: t.green }]}>
              ${splitAmount.toFixed(2)} each ({selected.length + 1} people including you)
            </Text>
          )}
        </Pressable>
      </View>

      {/* Reason */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Reason <Text style={[styles.labelOptional, { color: t.textMuted }]}>(optional)</Text></Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          inputAccessoryViewID={ACCESSORY_REASON}
          placeholder="Dinner, hotel, activity, etc."
          placeholderTextColor={t.textMuted}
          multiline
          value={reason}
          onChangeText={setReason}
        />
      </View>

      {/* Deadline */}
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>
          Deadline <Text style={[styles.labelOptional, { color: t.textMuted }]}>(optional)</Text>
        </Text>
        <View style={styles.deadlineRow}>
          <TextInput
            style={[styles.input, styles.deadlineInput, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            inputAccessoryViewID={ACCESSORY_DEADLINE}
            placeholder="MM/DD/YYYY"
            placeholderTextColor={t.textMuted}
            value={deadline}
            onChangeText={setDeadline}
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
          />
          {deadline.trim() ? (
            <Pressable style={[styles.clearBtn, { backgroundColor: t.input, borderColor: t.border }]} onPress={() => setDeadline("")}>
              <Text style={[styles.clearBtnText, { color: t.textSub }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        {deadlinePreview ? <Text style={[styles.dlPreview, { color: t.primary }]}>📅 {deadlinePreview}</Text> : null}
      </View>

      </ScrollView>
      <View style={[styles.saveBar, { backgroundColor: t.bg, borderTopColor: t.border }]}>
        <GradientButton label="Save Debt" onPress={handleSave} />
      </View>
      {Platform.OS === "ios" && [ACCESSORY_AMOUNT, ACCESSORY_REASON, ACCESSORY_DEADLINE].map(id => (
        <InputAccessoryView key={id} nativeID={id}>
          <View style={[styles.accessory, { backgroundColor: t.card, borderTopColor: t.border }]}>
            <Pressable onPress={Keyboard.dismiss} hitSlop={8}>
              <Text style={[styles.accessoryDone, { color: t.primary }]}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 24, flexGrow: 1 },
  saveBar: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1 },
  title: { fontSize: 32, fontWeight: "700", marginTop: 40 },
  subtitle: { fontSize: 16, marginBottom: 28 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  labelOptional: { fontSize: 14, fontWeight: "400" },
  input: { borderRadius: 14, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  selectAllText: { fontSize: 14, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 14, fontWeight: "600" },
  noMembers: { fontSize: 14, fontStyle: "italic" },
  optionBtn: { padding: 16, borderRadius: 14, borderWidth: 1 },
  optionText: { fontSize: 16, fontWeight: "600" },
  splitBtn: { padding: 16, borderRadius: 14, borderWidth: 1, marginTop: 4 },
  splitInner: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  splitText: { fontSize: 16, fontWeight: "600" },
  toggle: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  toggleText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  splitPreview: { fontSize: 13, marginTop: 6, fontWeight: "500" },
  deadlineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  deadlineInput: { flex: 1 },
  clearBtn: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  clearBtnText: { fontSize: 14, fontWeight: "600" },
  dlPreview: { fontSize: 13, marginTop: 6, fontWeight: "500" },
  accessory: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  accessoryDone: { fontSize: 16, fontWeight: "600" },
});
