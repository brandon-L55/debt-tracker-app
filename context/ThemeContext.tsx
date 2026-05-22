import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  bg: string;
  card: string;
  elevatedCard: string;
  input: string;
  text: string;
  textSub: string;
  textMuted: string;
  border: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  accentPink: string;
  green: string;
  greenSoft: string;
  greenBorder: string;
  red: string;
  redSoft: string;
  redBorder: string;
  warning: string;
};

const light: ThemeColors = {
  bg: "#F6F3FF",
  card: "#FFFFFF",
  elevatedCard: "#EFE9FF",
  input: "#FFFFFF",
  text: "#111827",
  textSub: "#64748B",
  textMuted: "#94A3B8",
  border: "#DDD6FE",
  primary: "#7C3AED",
  primarySoft: "#F3EFFF",
  primaryBorder: "#C4B5FD",
  accentPink: "#EC4899",
  green: "#00A884",
  greenSoft: "#E6FAF6",
  greenBorder: "#99E6D8",
  red: "#EF4444",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
  warning: "#F59E0B",
};

const dark: ThemeColors = {
  bg: "#080B1A",
  card: "#11162A",
  elevatedCard: "#1A2038",
  input: "#0F1528",
  text: "#F8FAFC",
  textSub: "#A8B3CF",
  textMuted: "#6F7A96",
  border: "#2A3152",
  primary: "#7C3AED",
  primarySoft: "#1C1040",
  primaryBorder: "#3D2A7A",
  accentPink: "#FF4ECD",
  green: "#06D6A0",
  greenSoft: "#032A20",
  greenBorder: "#065C45",
  red: "#FF5A5F",
  redSoft: "#2A0F10",
  redBorder: "#5A1518",
  warning: "#FFD166",
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
