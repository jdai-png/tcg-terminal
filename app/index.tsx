import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency, formatRelativeTime } from '../utils/format';
import { getTotalInvestment, getCardCount, getRecentActivity, getInvestmentBySet, Card, getPnLSummary, PnLSummary } from '../database';
import { DashboardSkeleton } from '../components/Skeleton';
import { PortfolioChart, StatCard } from '../components/InvestmentChart';
import { ErrorState } from '../components/EmptyState';

export default function DashboardScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [cardCount, setCardCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<Card[]>([]);
  const [investBySet, setInvestBySet] = useState<{ set_name: string; total: number; count: number }[]>([]);
  const [pnl, setPnl] = useState<PnLSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [total, count, recent, sets, pnlData] = await Promise.all([
        getTotalInvestment(),
        getCardCount(),
        getRecentActivity(5),
        getInvestmentBySet(),
        getPnLSummary(),
      ]);
      setTotalInvestment(total);
      setCardCount(count);
      setRecentActivity(recent);
      setInvestBySet(sets);
      setPnl(pnlData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const avgPrice = cardCount > 0 ? totalInvestment / cardCount : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Header */}
      <Text style={styles.header}>TCG Terminal</Text>
      <Text style={styles.subtitle}>
        {cardCount} cards tracked
      </Text>

      {/* P&L Summary */}
      {pnl && pnl.total_sales_count > 0 && (
        <View style={{ marginTop: Spacing.md }}>
          <Text style={styles.sectionTitle}>Profit & Loss</Text>
          <View style={styles.statRow}>
            <StatCard label="Sales Revenue" value={formatCurrency(pnl.total_sales_revenue)} accent={Colors.success} />
            <StatCard label="Gross Profit" value={formatCurrency(pnl.gross_profit)} accent={pnl.gross_profit >= 0 ? Colors.accent : Colors.danger} />
          </View>
          <View style={styles.statRow}>
            <StatCard label="ROI" value={`${pnl.avg_roi_pct >= 0 ? '+' : ''}${pnl.avg_roi_pct.toFixed(1)}%`} accent={pnl.avg_roi_pct >= 0 ? Colors.success : Colors.danger} />
            <StatCard label="Cards Sold" value={`${pnl.total_cards_sold}`} accent={Colors.accentBlue} />
          </View>
        </View>
      )}

      {/* Stat Cards */}
      <View style={{ marginTop: Spacing.md }}>
        <Text style={styles.sectionTitle}>Portfolio</Text>
        <View style={styles.statRow}>
          <StatCard label="Total Invested" value={formatCurrency(totalInvestment)} accent={Colors.accent} />
          <StatCard label="Avg / Card" value={formatCurrency(avgPrice)} accent={Colors.accentBlue} />
        </View>
      </View>

      {/* Chart */}
      {investBySet.length > 0 && (
        <View style={{ marginTop: Spacing.md }}>
          <PortfolioChart data={investBySet} totalInvestment={totalInvestment} />
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentActivity.length === 0 ? (
          <Text style={styles.emptyText}>No cards added yet. Scan or import to get started.</Text>
        ) : (
          recentActivity.map(card => (
            <TouchableOpacity
              key={card.id}
              style={styles.activityRow}
              onPress={() => router.push(`/inventory/${card.id}`)}
            >
              <View style={styles.activityLeft}>
                <Text style={styles.activityName} numberOfLines={1}>{card.name}</Text>
                <Text style={styles.activitySet}>{card.set_name}</Text>
              </View>
              <View style={styles.activityRight}>
                <Text style={styles.activityPrice}>{formatCurrency(card.price_paid)}</Text>
                <Text style={styles.activityTime}>{formatRelativeTime(card.updated_at)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    padding: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    color: Colors.text,
    fontSize: FontSize.xxl,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  statRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontStyle: 'italic',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  activityLeft: {
    flex: 1,
  },
  activityName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  activitySet: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  activityPrice: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  activityTime: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
});


