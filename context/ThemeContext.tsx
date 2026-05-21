import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  bg: string;
  card: string;
  input: string;
  text: string;
  textSub: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  green: string;
  greenSoft: string;
  greenBorder: string;
  red: string;
  redSoft: string;
  redBorder: string;
};

const light: ThemeColors = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  input: "#FFFFFF",
  text: "#111827",
  textSub: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E2E8F0",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  primaryBorder: "#BFDBFE",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  greenBorder: "#BBF7D0",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
};

const dark: ThemeColors = {
  bg: "#0F172A",
  card: "#1E293B",
  input: "#334155",
  text: "#F1F5F9",
  textSub: "#94A3B8",
  textMuted: "#64748B",
  border: "#334155",
  primary: "#3B82F6",
  primarySoft: "#1E3A5F",
  primaryBorder: "#2563EB",
  green: "#22C55E",
  greenSoft: "#052E16",
  greenBorder: "#14532D",
  red: "#EF4444",
  redSoft: "#450A0A",
  redBorder: "#7F1D1D",
};

type ThemeCtx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeCtx>({
  mode: "light",
  setMode: () => {},
  colors: light,
  isDark: false,
});

const KEY = "@debt_tracker/theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(KEY).then(v => {
      if (v === "light" || v === "dark") setModeState(v);
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    AsyncStorage.setItem(KEY, m);
  }

  const isDark = mode === "dark";

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors: isDark ? dark : light, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
