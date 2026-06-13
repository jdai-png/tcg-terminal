// Pokédex Theme — Industrial handheld scanner aesthetic
// Crimson hardware frame + holographic cyan data overlays + monospace typography
//
// Usage across pages:
//   import { DexColors, DexStyles, DexText, dexPanel, dexDivider } from '../utils/pokedex-theme';

import { StyleSheet, Platform } from 'react-native';
import { Spacing, FontSize } from './format';

// ─────────────────────────────────────────────────────────
//  COLOR PALETTE
// ─────────────────────────────────────────────────────────

export const DexColors = {
  // Hardware frame
  frame: '#DC2626',        // Vibrant Pokédex red (header, footer, decks)
  frameDark: '#991B1B',    // Deep crimson background
  frameBevel: '#7F1D1D',   // Dark recessed border (5px bevels)
  frameHighlight: '#EF4444', // Brighter red for accents

  // Lens & optics
  lensOuter: '#E2E8F0',    // Silver outer lens ring
  lensInner: '#38BDF8',    // Cyan glowing iris
  lensBorder: '#0284C7',   // Dark blue lens rim
  lensRing: '#475569',     // Gunmetal outer ring

  // Indicator LEDs
  ledRed: '#EF4444',
  ledAmber: '#F59E0B',
  ledGreen: '#10B981',
  ledHousing: '#1E293B',   // Dark border around each LED

  // Holographic data (overlays, found cards)
  holoCyan: '#00FFFF',     // Primary holographic glow
  holoCyanDim: 'rgba(0, 255, 255, 0.3)',
  holoCyanGlow: 'rgba(0, 255, 255, 0.8)',

  // Scanner targeting
  scanRed: '#FF3B30',      // Unknown/new card bounding box
  scanRedGlow: 'rgba(255, 59, 48, 0.8)',

  // Data panel (dark slate-cyan)
  panelBg: 'rgba(6, 15, 15, 0.94)',
  panelText: '#FFFFFF',
  panelMuted: '#8A9A9A',
  panelSecondary: '#7A8494',

  // Control deck
  btnGold: '#F59E0B',      // Action button
  btnGoldBorder: '#B45309',
  btnText: '#000000',
  dPad: '#1E293B',         // D-pad cross
  vent: '#7F1D1D',         // Vent lines
};

// ─────────────────────────────────────────────────────────
//  TYPOGRAPHY SCALE (Pokédex)
// ─────────────────────────────────────────────────────────

export const DexText = {
  // Industrial data labels
  dataHeader: {
    color: DexColors.panelMuted,
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
  },
  // Card name (monospace all-caps)
  cardName: {
    color: DexColors.panelText,
    fontSize: 14,
    fontWeight: '900' as const,
    letterSpacing: 0.5,
  },
  // Price value (holographic cyan)
  price: {
    color: DexColors.holoCyan,
    fontSize: 22,
    fontWeight: '800' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  // Secondary info
  meta: {
    color: DexColors.panelSecondary,
    fontSize: 10,
  },
  // Tap hints
  hint: {
    color: '#4A5464',
    fontSize: 9,
    fontStyle: 'italic' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  // Hardware button text
  actionBtn: {
    color: DexColors.btnText,
    fontWeight: '900' as const,
    fontSize: FontSize.md,
    letterSpacing: 0.5,
  },
  // Tab bar labels
  tabLabel: {
    fontSize: 9,
    fontWeight: '800' as const,
    letterSpacing: 1.5,
  },
};

// ─────────────────────────────────────────────────────────
//  SHARED STYLES
// ─────────────────────────────────────────────────────────

export const DexStyles = StyleSheet.create({
  // ── Full-page container (deep crimson background) ──
  container: {
    flex: 1,
    backgroundColor: DexColors.frameDark,
  },

  // ── Header bar (sits at top of any page) ──
  header: {
    height: 90,
    backgroundColor: DexColors.frame,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 5,
    borderBottomColor: DexColors.frameBevel,
    gap: Spacing.md,
    zIndex: 30,
  },
  headerTitle: {
    color: DexColors.panelText,
    fontSize: FontSize.lg,
    fontWeight: '900' as const,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },

  // ── Bottom deck (sits at bottom of any page) ──
  bottomDeck: {
    height: 120,
    backgroundColor: DexColors.frame,
    borderTopWidth: 5,
    borderTopColor: DexColors.frameBevel,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    zIndex: 30,
  },

  // ── Main lens (the Pokédex "eye") ──
  lensOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: DexColors.lensOuter,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: DexColors.lensRing,
  },
  lensInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: DexColors.lensInner,
    borderWidth: 4,
    borderColor: DexColors.lensBorder,
  },

  // ── LED indicator group ──
  ledGroup: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  led: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: DexColors.ledHousing,
  },

  // ── D-pad (decorative) ──
  dPad: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dPadHorizontal: {
    position: 'absolute',
    width: 60,
    height: 20,
    backgroundColor: DexColors.dPad,
    borderRadius: 2,
  },
  dPadVertical: {
    position: 'absolute',
    width: 20,
    height: 60,
    backgroundColor: DexColors.dPad,
    borderRadius: 2,
  },

  // ── Action button (golden) ──
  actionBtn: {
    backgroundColor: DexColors.btnGold,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: DexColors.btnGoldBorder,
  },

  // ── Vent lines (decorative) ──
  ventGroup: {
    gap: 4,
  },
  vent: {
    width: 40,
    height: 6,
    backgroundColor: DexColors.vent,
    borderRadius: 3,
  },

  // ── Data panel (dark slate-cyan card) ──
  dataPanel: {
    backgroundColor: DexColors.panelBg,
    borderWidth: 2,
    borderColor: DexColors.holoCyan,
    borderRadius: 4,
    padding: 12,
  },
});

// ─────────────────────────────────────────────────────────
//  INLINE STYLE HELPERS (for dynamic colors)
// ─────────────────────────────────────────────────────────

/**
 * Returns a StyleSheet-compatible panel with a dynamic border color.
 * Usage: <View style={dexPanel('#00FFFF')} />
 */
export function dexPanel(borderColor: string) {
  return {
    backgroundColor: DexColors.panelBg,
    borderWidth: 2,
    borderColor,
    borderRadius: 4,
    padding: 12,
  };
}

/**
 * Returns a holographic divider line style.
 * Usage: <View style={dexDivider()} />
 */
export function dexDivider(opacity: number = 0.3) {
  return {
    height: 1,
    backgroundColor: `rgba(0, 255, 255, ${opacity})`,
    marginVertical: 6,
  };
}

// ─────────────────────────────────────────────────────────
//  PAGE LAYOUT PRESET
// ─────────────────────────────────────────────────────────

/**
 * Standard Pokédex page structure:
 *   <View style={DexStyles.container}>
 *     <PokedexHeader title="INVENTORY" />
 *     <View style={DexStyles.content}>
 *       ...your page content...
 *     </View>
 *     <PokedexBottomDeck />
 *   </View>
 */
export const pageContent = {
  flex: 1,
  padding: Spacing.md,
} as const;
