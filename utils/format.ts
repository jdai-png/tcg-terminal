// Formatting utilities for TCG Terminal
// Design system: Direction A "Modern Collector" — dark, high-contrast, financial-grade

export const CURRENCY_SYMBOL = '$';

export function formatCurrency(amount: number): string {
  return `${CURRENCY_SYMBOL}${amount.toFixed(2)}`;
}

export function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `${CURRENCY_SYMBOL}${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${CURRENCY_SYMBOL}${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(dateStr);
}

export function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// ---- Design Tokens (Direction A) ----

export const Colors = {
  bg: '#0A0E14',
  bgCard: '#131820',
  bgInput: '#1A1F2B',
  border: '#1E2530',
  borderGlow: '#2A3340',
  text: '#E8ECF1',
  textSecondary: '#7A8494',
  textMuted: '#4A5464',
  accent: '#00D4AA',
  accentGlow: '#00D4AA33',
  accentBlue: '#3B82F6',
  accentBlueGlow: '#3B82F633',
  warning: '#F59E0B',
  danger: '#EF4444',
  success: '#10B981',
  condition: {
    Mint: '#00D4AA',
    'Near Mint': '#3B82F6',
    Excellent: '#8B5CF6',
    Good: '#F59E0B',
    'Light Played': '#F97316',
    Played: '#EF4444',
    Poor: '#6B7280',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
  xxl: 32,
  hero: 40,
};

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
};

// Shadow/glow for cards (dark theme)
export const cardShadow = {
  shadowColor: '#00D4AA',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.06,
  shadowRadius: 12,
  elevation: 4,
};
