import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal,
  Alert, RefreshControl, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency, formatDate } from '../../utils/format';
import {
  getPnLSummary, PnLSummary, getSalesHistory, Sale, getPnLByCard,
  recordSale, SaleInsert, deleteSale, getCardById, generateEndOfDayReport,
  getEndOfDayReportHistory, EndOfDayReport, getSalesForDate,
  getAllCards, Card,
} from '../../database';
import { StatCard } from '../../components/InvestmentChart';
import { Skeleton } from '../../components/Skeleton';
import { ErrorState } from '../../components/EmptyState';

export default function SalesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pnl, setPnl] = useState<PnLSummary | null>(null);
  const [salesHistory, setSalesHistory] = useState<Sale[]>([]);
  const [topCards, setTopCards] = useState<{ card_name: string; set_name: string; profit: number }[]>([]);
  const [eodReports, setEodReports] = useState<EndOfDayReport[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportDate, setSelectedReportDate] = useState<string | null>(null);
  const [reportSales, setReportSales] = useState<Sale[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [pnlData, history, cards, eodHistory] = await Promise.all([
        getPnLSummary(),
        getSalesHistory(30),
        getPnLByCard(),
        getEndOfDayReportHistory(7),
      ]);
      setPnl(pnlData);
      setSalesHistory(history);
      setTopCards(cards);
      setEodReports(eodHistory);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load sales data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleGenerateReport = async () => {
    try {
      const report = await generateEndOfDayReport();
      Alert.alert(
        '✓ EOD Report Generated',
        `Date: ${report.report_date}\nSales: ${formatCurrency(report.total_sales)}\nPurchases: ${formatCurrency(report.total_purchases)}\nProfit: ${formatCurrency(report.gross_profit)}`,
      );
      loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  const handleViewReport = async (date: string) => {
    setSelectedReportDate(date);
    try {
      const sales = await getSalesForDate(date);
      setReportSales(sales);
      setShowReportModal(true);
    } catch {
      Alert.alert('Error', 'Could not load report details');
    }
  };

  const handleDeleteSale = (sale: Sale) => {
    Alert.alert(
      'Delete Sale',
      `Remove the sale of "${sale.card_name}" for ${formatCurrency(sale.sale_price)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteSale(sale.id);
            loadData();
          },
        },
      ],
    );
  };

  if (error && salesHistory.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.header}>Sales</Text>
        </View>
        <ErrorState message={error} onRetry={loadData} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header + Actions */}
        <View style={styles.headerRow}>
          <Text style={styles.header}>Sales</Text>
          <TouchableOpacity
            style={styles.recordBtn}
            onPress={() => setShowRecordModal(true)}
          >
            <Text style={styles.recordBtnText}>+ Record Sale</Text>
          </TouchableOpacity>
        </View>

        {/* P&L Summary Cards */}
        {pnl && (
          <View style={styles.pnlSection}>
            <Text style={styles.sectionTitle}>Profit & Loss Overview</Text>
            <View style={styles.statRow}>
              <StatCard label="Sales Revenue" value={formatCurrency(pnl.total_sales_revenue)} accent={Colors.success} />
              <StatCard label="Cost Basis" value={formatCurrency(pnl.total_cost_basis)} accent={Colors.textSecondary} />
            </View>
            <View style={styles.statRow}>
              <StatCard
                label="Gross Profit"
                value={formatCurrency(pnl.gross_profit)}
                accent={pnl.gross_profit >= 0 ? Colors.accent : Colors.danger}
              />
              <StatCard
                label="Avg ROI"
                value={`${pnl.avg_roi_pct >= 0 ? '+' : ''}${pnl.avg_roi_pct.toFixed(1)}%`}
                accent={pnl.avg_roi_pct >= 0 ? Colors.success : Colors.danger}
              />
            </View>
            <View style={styles.statRow}>
              <StatCard label="Cards Sold" value={`${pnl.total_cards_sold}`} accent={Colors.accentBlue} />
              <StatCard label="Transactions" value={`${pnl.total_sales_count}`} accent={Colors.textSecondary} />
            </View>
          </View>
        )}

        {/* End of Day Reports */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>End of Day Reports</Text>
            <TouchableOpacity style={styles.eodGenerateBtn} onPress={handleGenerateReport}>
              <Text style={styles.eodGenerateText}>Generate Today</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <Skeleton height={44} />
          ) : eodReports.length === 0 ? (
            <Text style={styles.emptyText}>No reports yet. Generate an EOD report to see your daily P&L.</Text>
          ) : (
            eodReports.map(r => (
              <TouchableOpacity
                key={r.id}
                style={styles.eodRow}
                onPress={() => handleViewReport(r.report_date)}
              >
                <View style={styles.eodLeft}>
                  <Text style={styles.eodDate}>{formatDate(r.report_date)}</Text>
                  <Text style={styles.eodDetail}>
                    {r.total_sales_count} sales · {r.total_purchases_count} purchases
                  </Text>
                </View>
                <Text style={[
                  styles.eodProfit,
                  { color: r.gross_profit >= 0 ? Colors.success : Colors.danger },
                ]}>
                  {formatCurrency(r.gross_profit)}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Top Performing Cards */}
        {topCards.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Performing Cards</Text>
            {topCards.slice(0, 5).map((c, i) => (
              <View key={i} style={styles.topCardRow}>
                <View style={styles.topCardLeft}>
                  <Text style={styles.topCardRank}>#{i + 1}</Text>
                  <View>
                    <Text style={styles.topCardName} numberOfLines={1}>{c.card_name}</Text>
                    <Text style={styles.topCardSet} numberOfLines={1}>{c.set_name}</Text>
                  </View>
                </View>
                <Text style={[
                  styles.topCardProfit,
                  { color: c.profit >= 0 ? Colors.success : Colors.danger },
                ]}>
                  {formatCurrency(c.profit)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Sales History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sales</Text>
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={52} />)
          ) : salesHistory.length === 0 ? (
            <Text style={styles.emptyText}>No sales recorded yet. Tap "Record Sale" to get started.</Text>
          ) : (
            salesHistory.map(sale => (
              <TouchableOpacity
                key={sale.id}
                style={styles.saleRow}
                onLongPress={() => handleDeleteSale(sale)}
                delayLongPress={600}
              >
                <View style={styles.saleLeft}>
                  <Text style={styles.saleName} numberOfLines={1}>{sale.card_name}</Text>
                  <Text style={styles.saleSet} numberOfLines={1}>
                    {sale.set_name}
                    {sale.card_number ? ` · #${sale.card_number}` : ''}
                  </Text>
                  <View style={styles.saleMeta}>
                    <Text style={styles.saleDate}>{formatDate(sale.sale_date)}</Text>
                    {sale.buyer_name && (
                      <Text style={styles.saleBuyer}> · {sale.buyer_name}</Text>
                    )}
                    {sale.quantity > 1 && (
                      <Text style={styles.saleQty}> ×{sale.quantity}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.saleRight}>
                  <Text style={styles.salePrice}>{formatCurrency(sale.sale_price)}</Text>
                  <Text style={[
                    styles.saleProfit,
                    { color: sale.profit >= 0 ? Colors.success : Colors.danger },
                  ]}>
                    {sale.profit >= 0 ? '+' : ''}{formatCurrency(sale.profit)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Record Sale Modal */}
      <RecordSaleModal
        visible={showRecordModal}
        onClose={() => setShowRecordModal(false)}
        onSaved={() => { setShowRecordModal(false); loadData(); }}
      />

      {/* EOD Report Detail Modal */}
      <Modal visible={showReportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>EOD Report — {formatDate(selectedReportDate)}</Text>

            {reportSales.length === 0 ? (
              <Text style={styles.emptyText}>No sales recorded on this day.</Text>
            ) : (
              <ScrollView style={styles.reportSalesList}>
                {reportSales.map(s => (
                  <View key={s.id} style={styles.reportSaleRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.saleName}>{s.card_name}</Text>
                      <Text style={styles.saleSet}>{s.set_name}</Text>
                    </View>
                    <Text style={[
                      styles.saleProfit,
                      { color: s.profit >= 0 ? Colors.success : Colors.danger },
                    ]}>
                      {s.profit >= 0 ? '+' : ''}{formatCurrency(s.profit)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowReportModal(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ──────────────────── Record Sale Modal ────────────────────

function RecordSaleModal({ visible, onClose, onSaved }: {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [inventory, setInventory] = useState<Card[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [salePrice, setSalePrice] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingInv, setLoadingInv] = useState(false);

  const priceRef = useRef('');

  useEffect(() => { priceRef.current = salePrice; }, [salePrice]);
  useEffect(() => {
    if (visible) {
      setStep('select');
      setSelectedCard(null);
      setSalePrice('');
      setBuyerName('');
      setSaleNotes('');
      setSearch('');
      priceRef.current = '';
    }
  }, [visible]);

  const loadInventory = useCallback(async (term: string = '') => {
    setLoadingInv(true);
    try {
      const cards = await getAllCards({ search: term || undefined, includeArchived: false });
      setInventory(cards);
    } catch {} finally {
      setLoadingInv(false);
    }
  }, []);

  useEffect(() => {
    if (visible && step === 'select') {
      loadInventory(search);
    }
  }, [visible, step, search, loadInventory]);

  const handleSelectCard = (card: Card) => {
    if (card.archived === 1) {
      Alert.alert(
        'Card Archived',
        'This card has been archived (quantity reached 0). Un-archive it first from the Inventory detail screen before recording a sale.',
        [{ text: 'OK' }]
      );
      return;
    }
    setSelectedCard(card);
    setStep('details');
  };

  const handleKeyPress = useCallback((digit: string) => {
    const current = priceRef.current;
    if (digit === '.' && current.includes('.')) return;
    if (current.includes('.') && current.split('.')[1]?.length >= 2) return;
    const next = current + digit;
    priceRef.current = next;
    setSalePrice(next);
  }, []);

  const handleBackspace = useCallback(() => {
    const next = priceRef.current.slice(0, -1);
    priceRef.current = next;
    setSalePrice(next);
  }, []);

  const handleClear = useCallback(() => {
    priceRef.current = '';
    setSalePrice('');
  }, []);

  const handleSave = async () => {
    if (!selectedCard) return;
    const parsedPrice = parseFloat(salePrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid sale price.');
      return;
    }

    setSaving(true);
    try {
      await recordSale({
        card_id: selectedCard.id,
        card_name: selectedCard.name,
        set_name: selectedCard.set_name,
        card_number: selectedCard.card_number || undefined,
        rarity: selectedCard.rarity || undefined,
        condition: selectedCard.condition,
        cost_basis: selectedCard.price_paid,
        sale_price: parsedPrice,
        quantity: 1,
        buyer_name: buyerName.trim() || undefined,
        notes: saleNotes.trim() || undefined,
      });
      onSaved();
      Alert.alert('✓ Sale Recorded', `${selectedCard.name} sold for ${formatCurrency(parsedPrice)}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not record sale');
    } finally {
      setSaving(false);
    }
  };

  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  const hasPrice = salePrice.length > 0 && !isNaN(parseFloat(salePrice)) && parseFloat(salePrice) > 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalCardLarge}>
          {step === 'select' ? (
            <>
              <Text style={styles.modalTitle}>Select Card to Sell</Text>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search inventory..."
                  placeholderTextColor={Colors.textMuted}
                  autoFocus
                />
              </View>
              <ScrollView style={styles.cardList} showsVerticalScrollIndicator={false}>
                {loadingInv ? (
                  <ActivityIndicator color={Colors.accent} style={{ marginTop: Spacing.lg }} />
                ) : inventory.length === 0 ? (
                  <Text style={styles.emptyText}>No cards match your search.</Text>
                ) : (
                  inventory.map(card => {
                    const profit = parseInt(salePrice || '0') - card.price_paid;
                    return (
                      <TouchableOpacity
                        key={card.id}
                        style={styles.cardOption}
                        onPress={() => handleSelectCard(card)}
                      >
                        <View style={styles.cardOptionLeft}>
                          <Text style={styles.cardOptionName} numberOfLines={1}>{card.name}</Text>
                          <Text style={styles.cardOptionSet} numberOfLines={1}>
                            {card.set_name}
                            {card.card_number ? ` · #${card.card_number}` : ''}
                          </Text>
                          <Text style={styles.cardOptionMeta}>
                            Cost: {formatCurrency(card.price_paid)}
                            {card.quantity > 1 ? ` · ×${card.quantity} in stock` : ''}
                          </Text>
                        </View>
                        <Text style={styles.cardOptionArrow}>›</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep('select')}>
                <Text style={styles.backBtnText}>‹ Back to Card List</Text>
              </TouchableOpacity>

              {selectedCard && (
                <>
                  {/* Selected Card Info */}
                  <View style={styles.selectedCardInfo}>
                    <Text style={styles.selectedCardName}>{selectedCard.name}</Text>
                    <Text style={styles.selectedCardSet}>
                      {selectedCard.set_name}
                      {selectedCard.card_number ? ` · #${selectedCard.card_number}` : ''}
                    </Text>
                    <View style={styles.selectedCardStatRow}>
                      <MiniStat label="Cost Basis" value={formatCurrency(selectedCard.price_paid)} accent={Colors.textSecondary} />
                      <MiniStat label="Condition" value={selectedCard.condition} accent={Colors.condition[selectedCard.condition as keyof typeof Colors.condition] || Colors.textSecondary} />
                    </View>
                  </View>

                  {/* Sale Price Display */}
                  <Text style={styles.fieldLabel}>Sale Price</Text>
                  <View style={styles.priceDisplay}>
                    <View style={styles.priceRow}>
                      <Text style={styles.dollarSign}>$</Text>
                      <Text style={[styles.priceValue, !salePrice && styles.pricePlaceholder]}>
                        {salePrice || '0.00'}
                      </Text>
                    </View>
                    {hasPrice && (
                      <Text style={[
                        styles.profitPreview,
                        {
                          color: (parseFloat(salePrice) - selectedCard.price_paid) >= 0
                            ? Colors.success : Colors.danger,
                        },
                      ]}>
                        Profit: {formatCurrency(parseFloat(salePrice) - selectedCard.price_paid)}
                      </Text>
                    )}
                  </View>

                  {/* Keypad */}
                  <View style={styles.keypad}>
                    {keypad.map((row, ri) => (
                      <View key={ri} style={styles.keypadRow}>
                        {row.map(key => (
                          <TouchableOpacity
                            key={key}
                            style={[styles.key, key === '⌫' && styles.keyBackspace]}
                            onPress={() => { if (key === '⌫') handleBackspace(); else handleKeyPress(key); }}
                            activeOpacity={0.3}
                          >
                            <Text style={[styles.keyText, key === '⌫' && styles.keyTextBackspace]}>{key}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.clearPriceBtn} onPress={handleClear}>
                    <Text style={styles.clearPriceText}>Clear Price</Text>
                  </TouchableOpacity>

                  {/* Optional Fields */}
                  <View style={styles.optionalFields}>
                    <Field label="Buyer Name (optional)" value={buyerName} onChange={setBuyerName} placeholder="e.g. eBay buyer" />
                    <Field label="Notes (optional)" value={saleNotes} onChange={setSaleNotes} multiline placeholder="e.g. Shipped with tracking" />
                  </View>

                  {/* Save */}
                  <TouchableOpacity
                    style={[styles.saveBtn, (!hasPrice || saving) && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!hasPrice || saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={Colors.bg} />
                    ) : (
                      <Text style={styles.saveBtnText}>
                        Record Sale — {formatCurrency(parseFloat(salePrice || '0'))}
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Mini Components ───

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={miniStatStyles.box}>
      <Text style={[miniStatStyles.value, { color: accent }]}>{value}</Text>
      <Text style={miniStatStyles.label}>{label}</Text>
    </View>
  );
}

function Field({ label, value, onChange, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; placeholder?: string;
}) {
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && fieldStyles.multiline]}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={Colors.textMuted}
        placeholder={placeholder}
        multiline={multiline}
      />
    </View>
  );
}

// ─── Styles ───

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: {
    padding: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  header: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.5 },
  recordBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.accent,
  },
  recordBtnText: { color: Colors.bg, fontSize: FontSize.sm, fontWeight: '700' },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyText: { color: Colors.textMuted, fontSize: FontSize.sm, fontStyle: 'italic' },

  // P&L section
  pnlSection: { marginBottom: Spacing.lg },
  statRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },

  // EOD Reports
  eodGenerateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.accentGlow,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  eodGenerateText: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '600' },
  eodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  eodLeft: { flex: 1 },
  eodDate: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  eodDetail: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  eodProfit: { fontSize: FontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Top cards
  topCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  topCardRank: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '600', width: 24 },
  topCardName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500' },
  topCardSet: { color: Colors.textMuted, fontSize: FontSize.xs },
  topCardProfit: { fontSize: FontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },

  // Sales history
  saleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  saleLeft: { flex: 1, gap: 2 },
  saleName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500' },
  saleSet: { color: Colors.textSecondary, fontSize: FontSize.xs },
  saleMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  saleDate: { color: Colors.textMuted, fontSize: 10 },
  saleBuyer: { color: Colors.accentBlue, fontSize: 10 },
  saleQty: { color: Colors.textMuted, fontSize: 10 },
  saleRight: { alignItems: 'flex-end', gap: 2 },
  salePrice: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  saleProfit: { fontSize: FontSize.xs, fontWeight: '600', fontVariant: ['tabular-nums'] },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderGlow,
    maxHeight: '80%',
  },
  modalCardLarge: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderGlow,
    maxHeight: '92%',
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  modalCloseBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  modalCloseText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },

  // Card list in modal
  searchContainer: { marginBottom: Spacing.md },
  searchInput: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardList: { maxHeight: 400 },
  cardOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
  },
  cardOptionLeft: { flex: 1, gap: 2 },
  cardOptionName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
  cardOptionSet: { color: Colors.textSecondary, fontSize: FontSize.xs },
  cardOptionMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  cardOptionArrow: { color: Colors.textMuted, fontSize: FontSize.lg, fontWeight: '600' },

  // Back button
  backBtn: { paddingVertical: 8, marginBottom: Spacing.sm },
  backBtnText: { color: Colors.accentBlue, fontSize: FontSize.sm, fontWeight: '600' },

  // Selected card info
  selectedCardInfo: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCardName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  selectedCardSet: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  selectedCardStatRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },

  // Price entry
  fieldLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, textAlign: 'center' },
  priceDisplay: { alignItems: 'center', marginBottom: Spacing.md, backgroundColor: Colors.bgInput, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.accentGlow },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  dollarSign: { color: Colors.textSecondary, fontSize: FontSize.xl, fontWeight: '600', marginRight: 2 },
  priceValue: { color: Colors.accent, fontSize: FontSize.hero, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pricePlaceholder: { color: Colors.textMuted },
  profitPreview: { fontSize: FontSize.sm, fontWeight: '600', marginTop: 6 },

  keypad: { gap: Spacing.sm, marginBottom: Spacing.sm },
  keypadRow: { flexDirection: 'row', gap: Spacing.sm },
  key: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  keyBackspace: { backgroundColor: Colors.border },
  keyText: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '600' },
  keyTextBackspace: { fontSize: FontSize.lg, color: Colors.textSecondary },
  clearPriceBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: Spacing.md },
  clearPriceText: { color: Colors.textMuted, fontSize: FontSize.sm },

  // Optional fields
  optionalFields: { marginBottom: Spacing.md },

  // Save
  saveBtn: { paddingVertical: 16, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },

  // Report modal
  reportSalesList: { maxHeight: 300, marginBottom: Spacing.md },
  reportSaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
});

const miniStatStyles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: Colors.bg + '80',
    borderRadius: BorderRadius.sm,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: { fontSize: FontSize.sm, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: Colors.textMuted, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
});

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: Colors.bgInput, borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
});
