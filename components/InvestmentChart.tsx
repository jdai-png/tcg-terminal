import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { Colors, FontSize, Spacing, BorderRadius, formatCompactCurrency, formatCurrency } from '../utils/format';

interface InvestmentBySet {
  set_name: string;
  total: number;
  count: number;
}

interface PortfolioChartProps {
  data: InvestmentBySet[];
  totalInvestment: number;
}

export function PortfolioChart({ data, totalInvestment }: PortfolioChartProps) {
  if (data.length === 0) return null;

  const chartWidth = 320;
  const chartHeight = 200;
  const barMaxHeight = 140;
  const barWidth = 28;
  const gap = 8;
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  const top5 = data.slice(0, 5);

  // Simple color palette
  const barColors = ['#00D4AA', '#3B82F6', '#8B5CF6', '#F59E0B', '#F97316'];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Portfolio Breakdown</Text>
      <View style={styles.chartWrapper}>
        <Svg width={chartWidth} height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          {/* Baseline */}
          <Line x1={8} y1={chartHeight - 24} x2={chartWidth - 8} y2={chartHeight - 24} stroke={Colors.border} strokeWidth={1} />

          {top5.map((item, i) => {
            const barH = Math.max(4, (item.total / maxTotal) * barMaxHeight);
            const x = 20 + (i) * (barWidth + gap);
            const y = chartHeight - 24 - barH;

            return (
              <G key={i}>
                {/* Bar */}
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx={4}
                  ry={4}
                  fill={barColors[i]}
                  opacity={0.85}
                />
                {/* Value label */}
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 6}
                  fill={Colors.textSecondary}
                  fontSize={10}
                  textAnchor="middle"
                  fontWeight="600"
                >
                  {formatCompactCurrency(item.total)}
                </SvgText>
                {/* Set label */}
                <SvgText
                  x={x + barWidth / 2}
                  y={chartHeight - 8}
                  fill={Colors.textMuted}
                  fontSize={9}
                  textAnchor="middle"
                >
                  {item.set_name.length > 8 ? item.set_name.slice(0, 7) + '…' : item.set_name}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>
      <View style={styles.totalSection}>
        <Text style={styles.totalLabel}>Total Invested</Text>
        <Text style={styles.totalValue}>{formatCurrency(totalInvestment)}</Text>
      </View>
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  accent?: string;
}

export function StatCard({ label, value, accent = Colors.accent }: StatCardProps) {
  return (
    <View style={[statStyles.card, { borderColor: accent + '40' }]}>
      <Text style={statStyles.value} numberOfLines={1}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'flex-start',
    gap: 4,
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});

export { StatCard as default };

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  title: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  chartWrapper: {
    alignItems: 'center',
    marginLeft: -10,
  },
  totalSection: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  totalLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    color: Colors.accent,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    marginTop: 2,
  },
});
