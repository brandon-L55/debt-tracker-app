import { ViewStyle } from 'react-native';

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

type GlowTier = 'subtle' | 'medium' | 'strong';

const GLOW: Record<GlowTier, { offsetY: number; radius: number; opacity: number; elevation: number }> = {
  subtle: { offsetY: 6,  radius: 18, opacity: 0.20, elevation: 4  },
  medium: { offsetY: 10, radius: 28, opacity: 0.35, elevation: 8  },
  strong: { offsetY: 16, radius: 40, opacity: 0.50, elevation: 12 },
};

export function glow(color: string, tier: GlowTier = 'medium'): ViewStyle {
  const g = GLOW[tier];
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: g.offsetY },
    shadowOpacity: g.opacity,
    shadowRadius: g.radius,
    elevation: g.elevation,
  };
}
