import { Platform } from 'react-native';

export type AccentId =
  | 'neonPurplePink' | 'oceanBlueCyan' | 'emeraldMint' | 'sunsetOrangeRed'
  | 'goldAmber'      | 'roseMagenta'   | 'lilacMist'   | 'reefTeal';

export type Accent = {
  id: AccentId;
  name: string;
  from: string;
  mid: string;
  to: string;
  glow: string;
};

export const ACCENTS: readonly Accent[] = [
  { id: 'neonPurplePink',  name: 'Neon Purple/Pink',  from: '#8B5CF6', mid: '#C026D3', to: '#EC4899', glow: '#8B5CF6' },
  { id: 'oceanBlueCyan',   name: 'Ocean Blue/Cyan',   from: '#3B82F6', mid: '#0EA5E9', to: '#06B6D4', glow: '#3B82F6' },
  { id: 'emeraldMint',     name: 'Emerald/Mint',      from: '#10B981', mid: '#22C55E', to: '#84CC16', glow: '#10B981' },
  { id: 'sunsetOrangeRed', name: 'Sunset Orange/Red', from: '#FB923C', mid: '#F97316', to: '#EF4444', glow: '#FB923C' },
  { id: 'goldAmber',       name: 'Gold/Amber',        from: '#F59E0B', mid: '#EAB308', to: '#F97316', glow: '#F59E0B' },
  { id: 'roseMagenta',     name: 'Rose/Magenta',      from: '#F472B6', mid: '#E11D48', to: '#FB7185', glow: '#F472B6' },
  { id: 'lilacMist',       name: 'Lilac Mist',        from: '#A78BFA', mid: '#C4B5FD', to: '#DDD6FE', glow: '#A78BFA' },
  { id: 'reefTeal',        name: 'Reef Teal',         from: '#14B8A6', mid: '#06B6D4', to: '#0EA5E9', glow: '#14B8A6' },
] as const;

export const DEFAULT_ACCENT: AccentId = 'neonPurplePink';

// Legacy shim — keeps unused Expo boilerplate (collapsible, use-theme-color) compiling.
export const Colors = {
  light: { text: '#0F172A', background: '#F8FAFC', tint: '#8B5CF6', icon: '#64748B', tabIconDefault: '#94A3B8', tabIconSelected: '#8B5CF6' },
  dark:  { text: '#F1F5F9', background: '#0B1020', tint: '#8B5CF6', icon: '#94A3B8', tabIconDefault: '#64748B', tabIconSelected: '#8B5CF6' },
};

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', serif: 'ui-serif', rounded: 'ui-rounded', mono: 'ui-monospace' },
  default: { sans: 'normal', serif: 'serif', rounded: 'normal', mono: 'monospace' },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
