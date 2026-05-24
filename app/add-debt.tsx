import { useState, useRef, useEffect } from "react";
import { Alert, Dimensions, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useDebts } from "@/context/DebtContext";
import { useTheme } from "@/context/ThemeContext";
import { GradientButton } from "@/components/GradientButton";

function createDebtRequestId() {
  return `debt:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

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

export default function AddDebtScreen() {
  const router = useRouter();
  const { addDebt } = useDebts();
  const { colors: t } = useTheme();

  const [personInput, setPersonInput] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"them" | "me" | null>(null);
  const [splitEvenly, setSplitEvenly] = useState(false);
  const [deadline, setDeadline] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const saveInFlightRef = useRef(false);
  const saveRequestIdsRef = useRef<string[] | null>(null);
  const reasonRef = useRef<View>(null);
  const scrollY = useRef(0);
  const kbHeight = useRef(0);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", e => { kbHeight.current = e.endCoordinates.height; });
    const hide = Keyboard.addListener("keyboardDidHide", () => { kbHeight.current = 0; });
    return () => { show.remove(); hide.remove(); };
  }, []);

  function handleAddPerson() {
    const trimmed = personInput.trim();
    if (!trimmed || people.includes(trimmed)) { setPersonInput(""); return; }
    setPeople(prev => [...prev, trimmed]);
    setPersonInput("");
  }

  async function handleSave() {
    if (saveInFlightRef.current) return;
    saveInFlightRef.current = true;
    setIsSaving(true);
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      saveInFlightRef.current = false;
      setIsSaving(false);
      Alert.alert("Invalid amount", "Please enter an amount greater than $0.00.");
      return;
    }
    const trimmedInput = personInput.trim();
    const effectivePeople = trimmedInput && !people.includes(trimmedInput)
      ? [...people, trimmedInput]
      : people;
    if (effectivePeople.length === 0) {
      saveInFlightRef.current = false;
      setIsSaving(false);
      Alert.alert("No people added", "Add at least one person to this debt.");
      return;
    }
    if (!direction) {
      saveInFlightRef.current = false;
      setIsSaving(false);
      Alert.alert("Missing selection", 'Please select "They owe me" or "I owe them".');
      return;
    }
    let deadlineISO: string | null = null;
    if (deadline.trim()) {
      deadlineISO = parseDeadlineInput(deadline);
      if (!deadlineISO) {
        saveInFlightRef.current = false;
        setIsSaving(false);
        Alert.alert("Invalid date", "Enter the deadline as MM/DD/YYYY or leave it blank.");
        return;
      }
    }

    const perPersonAmount = splitEvenly ? parsedAmount / (effectivePeople.length + 1) : parsedAmount;
    if (!saveRequestIdsRef.current || saveRequestIdsRef.current.length !== effectivePeople.length) {
      saveRequestIdsRef.current = effectivePeople.map(() => createDebtRequestId());
    }
    try {
      for (let i = 0; i < effectivePeople.length; i += 1) {
        await addDebt({
          person: effectivePeople[i],
          amount: parseFloat(perPersonAmount.toFixed(2)),
          direction,
          reason: reason.trim(),
          deadline: deadlineISO,
          clientRequestId: saveRequestIdsRef.current[i],
        });
      }
      router.replace("/(tabs)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      Alert.alert("Could not save debt", msg);
      saveRequestIdsRef.current = null;
      saveInFlightRef.current = false;
      setIsSaving(false);
    }
  }

  const parsedAmount = parseFloat(amount) || 0;
  const splitAmount = people.length > 0 ? parsedAmount / (people.length + 1) : 0;
  const deadlinePreview = previewDeadline(deadline);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="height" enabled={Platform.OS === "android"}>
      <ScrollView
        ref={scrollRef}
        onScroll={e => { scrollY.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={100}
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: t.text }]}>Add New Debt</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>Track money owed between you and others.</Text>

        {/* People */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>People</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Name, phone, or @username"
            placeholderTextColor={t.textMuted}
            value={personInput}
            onChangeText={setPersonInput}
            onSubmitEditing={handleAddPerson}
            returnKeyType="done"
          />
          <Pressable style={[styles.addPersonBtn, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={handleAddPerson}>
            <Text style={[styles.addPersonBtnText, { color: t.primary }]}>+ Add Person</Text>
          </Pressable>
          {people.length > 0 && (
            <View style={styles.chips}>
              {people.map(p => (
                <View key={p} style={[styles.chip, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]}>
                  <Text style={[styles.chipText, { color: t.primary }]}>{p}</Text>
                  <Pressable onPress={() => setPeople(prev => prev.filter(x => x !== p))} hitSlop={8}>
                    <Text style={[styles.chipRemove, { color: t.primary }]}>×</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Amount</Text>
          <TextInput
            style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
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
          <Pressable
            style={[styles.splitBtn, {
              backgroundColor: splitEvenly ? t.greenSoft : t.card,
              borderColor: splitEvenly ? t.greenBorder : t.border,
            }]}
            onPress={() => setSplitEvenly(s => !s)}
          >
            <View style={styles.splitInner}>
              <Text style={[styles.splitText, { color: splitEvenly ? t.green : t.text }]}>Split Fee Evenly</Text>
              <View style={[styles.toggle, { backgroundColor: splitEvenly ? t.green : t.border }]}>
                <Text style={styles.toggleText}>{splitEvenly ? "ON" : "OFF"}</Text>
              </View>
            </View>
            {splitEvenly && people.length > 0 && parsedAmount > 0 && (
              <Text style={[styles.splitPreview, { color: t.green }]}>
                ${splitAmount.toFixed(2)} each ({people.length + 1} people including you)
              </Text>
            )}
          </Pressable>
          {(["them", "me"] as const).map(opt => (
            <Pressable
              key={opt}
              style={[
                styles.optionBtn,
                {
                  backgroundColor: direction === opt ? t.primarySoft : t.card,
                  borderColor: direction === opt ? t.primaryBorder : t.border,
                },
                { marginTop: 10 },
              ]}
              onPress={() => setDirection(direction === opt ? null : opt)}
            >
              <Text style={[styles.optionText, { color: direction === opt ? t.primary : t.text }]}>
                {opt === "them" ? "They owe me" : "I owe them"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Reason */}
        <View ref={reasonRef} style={styles.formGroup}>
          <Text style={[styles.label, { color: t.text }]}>Reason <Text style={[styles.labelOptional, { color: t.textMuted }]}>(optional)</Text></Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
            placeholder="Dinner, tickets, Uber, rent, etc."
            placeholderTextColor={t.textMuted}
            multiline
            scrollEnabled={false}
            value={reason}
            onChangeText={setReason}
            onFocus={() => {
              setTimeout(() => {
                reasonRef.current?.measureInWindow((_x, y, _w, h) => {
                  const windowH = Dimensions.get("window").height;
                  const fieldBottom = y + h;
                  const clearance = windowH - kbHeight.current - 16;
                  if (fieldBottom > clearance) {
                    scrollRef.current?.scrollTo({ y: scrollY.current + fieldBottom - clearance, animated: true });
                  }
                });
              }, 350);
            }}
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

        <GradientButton
          label={isSaving ? "Saving..." : "Save Debt"}
          onPress={handleSave}
          disabled={isSaving}
          style={{ marginTop: 10, marginBottom: 40 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 160, flexGrow: 1 },
  title: { fontSize: 32, fontWeight: "800", marginTop: 40, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginBottom: 28, marginTop: 6 },
  formGroup: { marginBottom: 22 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  labelOptional: { fontSize: 14, fontWeight: "400" },
  input: { borderRadius: 16, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  addPersonBtn: { borderRadius: 16, padding: 14, alignItems: "center", borderWidth: 1, marginTop: 8 },
  addPersonBtnText: { fontSize: 15, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { flexDirection: "row", alignItems: "center", borderRadius: 20, paddingVertical: 6, paddingLeft: 12, paddingRight: 8, borderWidth: 1, gap: 4 },
  chipText: { fontSize: 14, fontWeight: "600" },
  chipRemove: { fontSize: 18, lineHeight: 20 },
  optionBtn: { padding: 16, borderRadius: 16, borderWidth: 1 },
  optionText: { fontSize: 16, fontWeight: "600" },
  splitBtn: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
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
});
