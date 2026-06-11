import * as ImagePicker from "expo-image-picker";
import { useState, useEffect } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useContacts } from "@/context/ContactsContext";
import { useTheme } from "@/context/ThemeContext";
import { Avatar } from "@/components/Avatar";
import { DoneBar } from "@/components/DoneBar";
import { GradientButton } from "@/components/GradientButton";
import { blockUser, unblockUser, isUserBlocked } from "@/lib/services/blockService";

const ACCESSORY_ID = "edit-individual";

export default function EditIndividualScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { individuals, updateIndividual } = useContacts();
  const { colors: t, isDark } = useTheme();

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const person = individuals.find(ind => ind.id === resolvedId);

  const [name, setName] = useState(person?.name ?? "");
  const [nickname, setNickname] = useState(person?.nickname ?? "");
  const [phoneOrUsername, setPhoneOrUsername] = useState(person?.phoneOrUsername ?? "");
  const [notes, setNotes] = useState(person?.notes ?? "");
  const [imageUri, setImageUri] = useState(person?.imageUri ?? "");
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  useEffect(() => {
    const linkedId = person?.linkedUserId;
    if (!linkedId) return;
    isUserBlocked(linkedId).then(setIsBlocked).catch(() => {});
  }, [person?.linkedUserId]);

  if (!person) {
    return (
      <View style={[styles.notFound, { backgroundColor: t.bg }]}>
        <Text style={{ color: t.textMuted, fontSize: 16 }}>Person not found.</Text>
      </View>
    );
  }

  async function pickImage() {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  }

  function confirmBlock() {
    Alert.alert(
      "Block Contact?",
      "They won't be able to send you debt requests or nudges.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            if (!person.linkedUserId) return;
            setBlockLoading(true);
            try {
              await blockUser(person.linkedUserId);
              setIsBlocked(true);
              Alert.alert(
                "Contact Blocked",
                "To view or unblock them later, go to Settings → Contacts → Blocked Contacts.",
                [{ text: "OK" }],
              );
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not block contact.");
            } finally {
              setBlockLoading(false);
            }
          },
        },
      ],
    );
  }

  function confirmUnblock() {
    Alert.alert(
      "Unblock Contact?",
      "They will be able to interact with you again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            if (!person.linkedUserId) return;
            setBlockLoading(true);
            try {
              await unblockUser(person.linkedUserId);
              setIsBlocked(false);
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not unblock contact.");
            } finally {
              setBlockLoading(false);
            }
          },
        },
      ],
    );
  }

  function handleSave() {
    if (!name.trim()) {
      Alert.alert("Missing field", "Name is required.");
      return;
    }
    updateIndividual(resolvedId, {
      name: name.trim(),
      nickname: nickname.trim(),
      phoneOrUsername: phoneOrUsername.trim(),
      notes: notes.trim(),
      imageUri: imageUri || undefined,
    });
    router.replace("/(tabs)/individuals");
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 20}>
      <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 260 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"} showsVerticalScrollIndicator={false}>

      <View style={styles.avatarSection}>
        <View style={[styles.avatarRing, {
          borderColor: isDark ? "#7C3AED" : "#C4B5FD",
          backgroundColor: isDark ? "#1C1040" : "#F3EFFF",
          ...(isDark ? { shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 16 } : {}),
        }]}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.avatarImage} />
          ) : (
            <Avatar name={name || person.name} size={80} />
          )}
        </View>
        <Pressable style={[styles.changePhotoButton, { backgroundColor: t.primarySoft, borderColor: t.primaryBorder }]} onPress={pickImage}>
          <Text style={[styles.changePhotoText, { color: t.primary }]}>Change Photo</Text>
        </Pressable>
        {imageUri ? (
          <Pressable onPress={() => setImageUri("")}>
            <Text style={[styles.removePhotoText, { color: t.textMuted }]}>Remove Photo</Text>
          </Pressable>
        ) : null}
        {isBlocked && (
          <View style={[styles.blockedBadge, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
            <Text style={[styles.blockedBadgeText, { color: t.red }]}>Blocked</Text>
          </View>
        )}
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Full name"
          placeholderTextColor={t.textMuted}
          inputAccessoryViewID={ACCESSORY_ID}
          value={name}
          onChangeText={setName}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Nickname</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="What do you call them?"
          placeholderTextColor={t.textMuted}
          inputAccessoryViewID={ACCESSORY_ID}
          value={nickname}
          onChangeText={setNickname}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Phone or username</Text>
        <TextInput
          style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="+1 555-000-0000 or @username"
          placeholderTextColor={t.textMuted}
          inputAccessoryViewID={ACCESSORY_ID}
          value={phoneOrUsername}
          onChangeText={setPhoneOrUsername}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: t.text }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
          placeholder="Any notes about this person..."
          placeholderTextColor={t.textMuted}
          inputAccessoryViewID={ACCESSORY_ID}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
      </View>

      {person.linkedUserId ? (
        <View style={[styles.blockSection, { borderTopColor: t.border }]}>
          {isBlocked ? (
            <Pressable
              style={[styles.blockBtn, styles.unblockBtn, { borderColor: t.border, backgroundColor: t.card, opacity: blockLoading ? 0.6 : 1 }]}
              onPress={confirmUnblock}
              disabled={blockLoading}
            >
              <Text style={[styles.blockBtnText, { color: t.text }]}>
                {blockLoading ? "Unblocking…" : "Unblock Contact"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.blockBtn, { borderColor: t.redBorder, backgroundColor: t.redSoft, opacity: blockLoading ? 0.6 : 1 }]}
              onPress={confirmBlock}
              disabled={blockLoading}
            >
              <Text style={[styles.blockBtnText, { color: t.red }]}>
                {blockLoading ? "Blocking…" : "Block Contact"}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={[styles.blockSection, { borderTopColor: t.border }]}>
          <View style={[styles.blockBtn, { borderColor: t.border, backgroundColor: t.card, opacity: 0.5 }]}>
            <Text style={[styles.blockBtnText, { color: t.textMuted }]}>Block Contact</Text>
          </View>
          <Text style={[styles.blockHint, { color: t.textMuted }]}>
            This contact doesn't have an account yet.
          </Text>
        </View>
      )}

      <GradientButton
        label="Save Changes"
        onPress={handleSave}
        style={{ marginTop: 10, marginBottom: 40 }}
      />
    </ScrollView>
    <DoneBar nativeID={ACCESSORY_ID} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, justifyContent: "center", alignItems: "center" },
  avatarSection: { alignItems: "center", paddingVertical: 28, gap: 12 },
  avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  avatarImage: { width: 92, height: 92, borderRadius: 46 },
  changePhotoButton: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  changePhotoText: { fontSize: 14, fontWeight: "600" },
  removePhotoText: { fontSize: 13 },
  blockedBadge: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  blockedBadgeText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.5 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  input: { borderRadius: 16, padding: 16, fontSize: 16, borderWidth: 1 },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  blockSection: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8, paddingTop: 20, marginBottom: 8 },
  blockBtn: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  unblockBtn: {},
  blockBtnText: { fontSize: 15, fontWeight: "700" },
  blockHint: { fontSize: 12, textAlign: "center", marginTop: 8 },
});
