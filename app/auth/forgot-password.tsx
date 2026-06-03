import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { DoneBar } from "@/components/DoneBar";
import { GotchuLatrLogo } from "@/components/GotchuLatrLogo";

const ACCESSORY_ID = "auth-forgot-password";

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const { colors: t } = useTheme();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    setError(null);
    const trimmed = email.trim().toLowerCase();

    if (!trimmed) {
      setError("Please enter your email address.");
      return;
    }
    if (!isValidEmail(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    const err = await resetPassword(trimmed);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: t.bg }]}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={styles.successIcon}>📩</Text>
          <Text style={[styles.successTitle, { color: t.text }]}>Check your email</Text>
          <Text style={[styles.successBody, { color: t.textSub }]}>
            We sent a password reset link to{"\n"}
            <Text style={{ color: t.text, fontWeight: "600" }}>{email.trim().toLowerCase()}</Text>
            {"\n\n"}Click the link in the email to set a new password.
          </Text>
          <Pressable onPress={() => router.replace("/auth/login")}>
            <LinearGradient
              colors={[t.from, t.mid, t.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              <Text style={styles.buttonText}>Back to Sign In</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.bg }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={styles.logoWrap}>
          <GotchuLatrLogo size={80} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>Reset password</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>
          Enter the email address on your account and we{"'"}ll send you a reset link.
        </Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Email address</Text>
            <View style={[styles.inputWrapper, { backgroundColor: t.input, borderColor: t.border }]}>
              <Ionicons name="mail-outline" size={18} color={t.textMuted} style={styles.inputIconLeft} />
              <TextInput
                style={[styles.input, { color: t.text }]}
                placeholder="you@example.com"
                placeholderTextColor={t.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="go"
                inputAccessoryViewID={ACCESSORY_ID}
                onSubmitEditing={handleSubmit}
              />
            </View>
          </View>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
              <Text style={[styles.errorText, { color: t.red }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={loading ? { opacity: 0.6 } : undefined}
          >
            <LinearGradient
              colors={[t.from, t.mid, t.to]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientBtn}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Send reset link</Text>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backText, { color: t.textSub }]}>Back to Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DoneBar nativeID={ACCESSORY_ID} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  centerContainer: { flex: 1, justifyContent: "center", padding: 24 },
  logoWrap: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 15, textAlign: "center", marginBottom: 28, lineHeight: 22 },
  card: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    gap: 8,
  },
  inputIconLeft: { flexShrink: 0 },
  input: { flex: 1, fontSize: 16, padding: 0 },
  errorBox: { borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText: { fontSize: 14 },
  gradientBtn: {
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  backBtn: { alignItems: "center", marginTop: -4 },
  backText: { fontSize: 14 },
  successIcon: { fontSize: 48, textAlign: "center", marginBottom: 8 },
  successTitle: { fontSize: 22, fontWeight: "700", textAlign: "center", marginBottom: 12 },
  successBody: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 4 },
});
