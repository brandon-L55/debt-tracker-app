import React from "react";
import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

function FallbackScreen({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const dark = useColorScheme() === "dark";
  const bg     = dark ? "#0F172A" : "#F8FAFC";
  const card   = dark ? "#1E293B" : "#FFFFFF";
  const border = dark ? "#334155" : "#E2E8F0";
  const text   = dark ? "#F1F5F9" : "#0F172A";
  const sub    = dark ? "#94A3B8" : "#64748B";

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={[styles.title, { color: text }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: sub }]}>
          An unexpected error occurred. Your data is safe — tap below to try again.
        </Text>
        {__DEV__ && error ? (
          <Text style={styles.devError} numberOfLines={5}>
            {error.message}
          </Text>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          onPress={onRetry}
        >
          <Text style={styles.btnText}>Try Again</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error("[ErrorBoundary] Uncaught error:", error);
      console.error("[ErrorBoundary] Component stack:", info.componentStack);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return <FallbackScreen error={this.state.error} onRetry={this.reset} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: {
    width: "100%", maxWidth: 400, borderRadius: 20, borderWidth: 1,
    padding: 28, alignItems: "center", gap: 12,
  },
  icon:     { fontSize: 40 },
  title:    { fontSize: 20, fontWeight: "700", textAlign: "center" },
  message:  { fontSize: 14, textAlign: "center", lineHeight: 20 },
  devError: { fontSize: 12, color: "#EF4444", fontFamily: "monospace", textAlign: "left", alignSelf: "stretch" },
  btn:      { marginTop: 8, backgroundColor: "#2563EB", paddingVertical: 14, paddingHorizontal: 32, borderRadius: 14 },
  btnText:  { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
