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
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { colors: t } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSignup() {
    setError(null);
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter a password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const err = await signUp(trimmedEmail, password);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: t.bg }]}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[styles.successIcon]}>✅</Text>
          <Text style={[styles.successTitle, { color: t.text }]}>Check your email</Text>
          <Text style={[styles.successBody, { color: t.textSub }]}>
            We've sent a confirmation link to{"\n"}
            <Text style={{ color: t.text, fontWeight: "600" }}>{email.trim().toLowerCase()}</Text>
            {"\n\n"}Click the link to activate your account, then sign in.
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: t.primary }]}
            onPress={() => router.replace("/auth/login")}
          >
            <Text style={styles.buttonText}>Back to Sign In</Text>
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
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.title, { color: t.text }]}>Create account</Text>
        <Text style={[styles.subtitle, { color: t.textSub }]}>
          Start tracking debts for free
        </Text>

        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="you@example.com"
              placeholderTextColor={t.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="Min. 6 characters"
              placeholderTextColor={t.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="next"
            />
          </View>

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: t.textSub }]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: t.input, borderColor: t.border, color: t.text }]}
              placeholder="••••••••"
              placeholderTextColor={t.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={handleSignup}
            />
          </View>

          {/* Error */}
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: t.redSoft, borderColor: t.redBorder }]}>
              <Text style={[styles.errorText, { color: t.red }]}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            style={[styles.button, { backgroundColor: t.primary }, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </Pressable>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.textSub }]}>
            Already have an account?{" "}
          </Text>
          <Pressable onPress={() => router.push("/auth/login")}>
            <Text style={[styles.footerLink, { color: t.primary }]}>Sign In</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    paddingBottom: 48,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  errorBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 14,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: "600",
  },
  successIcon: {
    fontSize: 48,
    textAlign: "center",
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  successBody: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 4,
  },
});
