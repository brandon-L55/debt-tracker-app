import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { ACCENTS, DEFAULT_ACCENT } from "@/constants/theme";
import type { AccentId } from "@/constants/theme";

export type ThemeMode = "light" | "dark";

export type ThemeColors = {
  bg: string;
  bg2: string;
  card: string;
  elevatedCard: string;
  cardElev: string;
  input: string;
  text: string;
  textSub: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  primary: string;
  primarySoft: string;
  primaryBorder: string;
  from: string;
  to: string;
  mid: string;
  accentPink: string;
  green: string;
  greenSoft: string;
  greenBorder: string;
  red: string;
  redSoft: string;
  redBorder: string;
  amber: string;
  warning: string;
};

const lightBase = {
  bg: "#F8FAFC",
  bg2: "#FFFFFF",
  card: "#FFFFFF",
  elevatedCard: "#FFFFFF",
  cardElev: "#FFFFFF",
  input: "#FFFFFF",
  text: "#0F172A",
  textSub: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  green: "#16A34A",
  greenSoft: "#F0FDF4",
  greenBorder: "#BBF7D0",
  red: "#DC2626",
  redSoft: "#FEF2F2",
  redBorder: "#FECACA",
  amber: "#D97706",
  warning: "#D97706",
};

const darkBase = {
  bg: "#0B1020",
  bg2: "#0F172A",
  card: "#1A2236",
  elevatedCard: "#212B43",
  cardElev: "#212B43",
  input: "#1F2A44",
  text: "#F1F5F9",
  textSub: "#94A3B8",
  textMuted: "#64748B",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.12)",
  green: "#22C55E",
  greenSoft: "rgba(34,197,94,0.12)",
  greenBorder: "rgba(34,197,94,0.25)",
  red: "#F43F5E",
  redSoft: "rgba(244,63,94,0.12)",
  redBorder: "rgba(244,63,94,0.25)",
  amber: "#F59E0B",
  warning: "#F59E0B",
};

function buildColors(mode: ThemeMode, accentId: AccentId): ThemeColors {
  const isDark = mode === "dark";
  const base = isDark ? darkBase : lightBase;
  const accentObj = ACCENTS.find(a => a.id === accentId) ?? ACCENTS[0];
  const softAlpha = isDark ? "22" : "15";
  const borderAlpha = isDark ? "44" : "40";
  return {
    ...base,
    primary: accentObj.from,
    primarySoft: accentObj.from + softAlpha,
    primaryBorder: accentObj.from + borderAlpha,
    from: accentObj.from,
    to: accentObj.to,
    mid: accentObj.mid,
    accentPink: accentObj.to,
  };
}

type ThemeCtx = {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
  accent: AccentId;
  setAccent: (a: AccentId) => void;
};

const ThemeContext = createContext<ThemeCtx>({
  mode: "light",
  setMode: () => {},
  colors: buildColors("light", DEFAULT_ACCENT),
  isDark: false,
  accent: DEFAULT_ACCENT,
  setAccent: () => {},
});

const MODE_KEY = "@debt_tracker/theme_mode";
const ACCENT_KEY = "@debt_tracker/accent";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT);

  useEffect(() => {
    AsyncStorage.multiGet([MODE_KEY, ACCENT_KEY]).then(pairs => {
      const modeVal = pairs[0][1];
      const accentVal = pairs[1][1];
      if (modeVal === "light" || modeVal === "dark") setModeState(modeVal);
      if (accentVal && ACCENTS.some(a => a.id === accentVal)) setAccentState(accentVal as AccentId);
    });
  }, []);

  function setMode(m: ThemeMode) {
    setModeState(m);
    AsyncStorage.setItem(MODE_KEY, m);
  }

  function setAccent(a: AccentId) {
    setAccentState(a);
    AsyncStorage.setItem(ACCENT_KEY, a);
  }

  const isDark = mode === "dark";

  return (
    <ThemeContext.Provider value={{ mode, setMode, colors: buildColors(mode, accent), isDark, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
