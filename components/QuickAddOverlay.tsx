import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Vibration, Platform, Alert, ScrollView,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency, formatDate } from '../utils/format';
import { CardInsert, insertCard, updateCard, Card } from '../database';

interface QuickAddOverlayProps {
  visible: boolean;
  scannedData: { name: string; set_name: string; card_number?: string; dbId?: number } | null;
  /** Card found by exact ID match (lookup mode) */
  foundCard: Card | null;
  /** Cards found by name/set match (registration mode) */
  existingCards: Card[];
  onClose: () => void;
  onSaved: () => void;
}

export function QuickAddOverlay({
  visible, scannedData, foundCard, existingCards, onClose, onSaved,
}: QuickAddOverlayProps) {
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  const priceRef = useRef('');
  const scannedRef = useRef(scannedData);

  useEffect(() => { priceRef.current = price; }, [price]);
  useEffect(() => { scannedRef.current = scannedData; }, [scannedData]);
  useEffect(() => { if (visible) { setPrice(''); setSaving(false); } }, [visible]);

  // ── MODE DETECTION ──
  const isLookup = !!foundCard; // Card was found by its unique ID

  // ── Keypad handlers ──
  const handleKeyPress = useCallback((digit: string) => {
    const current = priceRef.current;
    if (digit === '.' && current.includes('.')) return;
    if (current.includes('.') && current.split('.')[1]?.length >= 2) return;
    const next = current + digit;
    priceRef.current = next;
    setPrice(next);
  }, []);

  const handleBackspace = useCallback(() => {
    const next = priceRef.current.slice(0, -1);
    priceRef.current = next;
    setPrice(next);
  }, []);

  const handleClear = useCallback(() => {
    priceRef.current = '';
    setPrice('');
  }, []);

  // ── Save new card (registration mode) ──
  const handleSaveNew = useCallback(async () => {
    const currentPrice = priceRef.current;
    const data = scannedRef.current;
    if (!data || !currentPrice) return;

    const parsedPrice = parseFloat(currentPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price greater than $0.00');
      return;
    }

    setSaving(true);
    const card: CardInsert = {
      name: data.name || 'Unknown Card',
      set_name: data.set_name,
      card_number: data.card_number,
      price_paid: parsedPrice,
      condition: 'Near Mint',
    };

    try {
      await insertCard(card);
      priceRef.current = '';
      setPrice('');
      try { if (Platform.OS !== 'web') Vibration.vibrate(50); } catch {}
      onSaved();
      onClose();
      Alert.alert('✓ Saved', `${data.name} — $${parsedPrice.toFixed(2)}`, [{ text: 'OK' }], { cancelable: true });
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save card.');
    } finally {
      setSaving(false);
    }
  }, [onSaved, onClose]);

  // ── Update price on existing card (lookup mode) ──
  const handleUpdatePrice = useCallback(async () => {
    const currentPrice = priceRef.current;
    if (!foundCard || !currentPrice) return;

    const parsedPrice = parseFloat(currentPrice);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      await updateCard(foundCard.id, { price_paid: parsedPrice });
      priceRef.current = '';
      setPrice('');
      try { if (Platform.OS !== 'web') Vibration.vibrate(50); } catch {}
      onSaved();
      onClose();
      Alert.alert('✓ Updated', `${foundCard.name} → $${parsedPrice.toFixed(2)}`, [{ text: 'OK' }], { cancelable: true });
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update card.');
    } finally {
      setSaving(false);
    }
  }, [foundCard, onSaved, onClose]);

  // ── Quick-add another copy at same price (lookup mode) ──
  const handleAddAnother = useCallback(async () => {
    if (!foundCard) return;
    setSaving(true);
    try {
      await insertCard({
        name: foundCard.name,
        set_name: foundCard.set_name,
        card_number: foundCard.card_number || undefined,
        rarity: foundCard.rarity || undefined,
        condition: foundCard.condition,
        price_paid: foundCard.price_paid,
      });
      try { if (Platform.OS !== 'web') Vibration.vibrate(50); } catch {}
      onSaved();
      onClose();
      Alert.alert('✓ Added', `${foundCard.name} — $${foundCard.price_paid.toFixed(2)} (another copy)`, [{ text: 'OK' }], { cancelable: true });
    } catch (err: any) {
      Alert.alert('Failed', err?.message || 'Could not add card.');
    } finally {
      setSaving(false);
    }
  }, [foundCard, onSaved, onClose]);

  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  const hasPrice = price.length > 0 && !isNaN(parseFloat(price)) && parseFloat(price) > 0;

  // ─────────────────────────────────────────────────────
  //  LOOKUP MODE: Card found by unique ID
  // ─────────────────────────────────────────────────────
  if (isLookup && foundCard) {
    const totalValue = foundCard.price_paid * foundCard.quantity;
    const condColor = Colors.condition[foundCard.condition as keyof typeof Colors.condition] || Colors.textSecondary;

    return (
      <Modal visible={visible} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
              {/* Header */}
              <Text style={styles.title}>✓ Card Found</Text>
              <View style={styles.scanInfo}>
                <Text style={styles.cardName}>{foundCard.name}</Text>
                <Text style={styles.cardSet}>
                  {foundCard.set_name}
                  {foundCard.card_number ? ` · #${foundCard.card_number}` : ''}
                </Text>
                {foundCard.rarity && <Text style={styles.cardRarity}>{foundCard.rarity}</Text>}
              </View>

              {/* Existing data panel */}
              <View style={styles.foundPanel}>
                <View style={styles.foundGrid}>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>Price Paid</Text>
                    <Text style={[styles.statValue, { color: Colors.accent }]}>
                      {formatCurrency(foundCard.price_paid)}
                    </Text>
                  </View>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>Quantity</Text>
                    <Text style={[styles.statValue, { color: Colors.accentBlue }]}>
                      ×{foundCard.quantity}
                    </Text>
                  </View>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>Total Value</Text>
                    <Text style={[styles.statValue, { color: Colors.warning }]}>
                      {formatCurrency(totalValue)}
                    </Text>
                  </View>
                  <View style={styles.statColumn}>
                    <Text style={styles.statLabel}>Condition</Text>
                    <Text style={[styles.statValue, { color: condColor }]}>
                      {foundCard.condition}
                    </Text>
                  </View>
                </View>

                <View style={styles.foundDetail}>
                  <Text style={styles.foundDetailText}>
                    Purchased: <Text style={styles.foundDetailValue}>{formatDate(foundCard.purchase_date || foundCard.created_at)}</Text>
                  </Text>
                  <Text style={styles.foundDetailText}>
                    ID: <Text style={styles.foundDetailValue}>{foundCard.id}</Text>
                  </Text>
                </View>
              </View>

              {/* Quick actions */}
              <View style={styles.lookupActions}>
                <TouchableOpacity style={styles.addAnotherBtn} onPress={handleAddAnother} disabled={saving}>
                  <Text style={styles.addAnotherText}>
                    + Add Another Copy (${foundCard.price_paid.toFixed(2)})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Update price section */}
              <View style={styles.divider} />
              <Text style={styles.updateLabel}>Update Price</Text>

              <View style={styles.priceDisplay}>
                <View style={styles.priceRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <Text style={[styles.priceValue, !price && styles.pricePlaceholder]}>
                    {price || '0.00'}
                  </Text>
                </View>
              </View>

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

              <View style={styles.actions}>
                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                  <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, (!hasPrice || saving) && styles.saveBtnDisabled]}
                  onPress={handleUpdatePrice}
                  disabled={!hasPrice || saving}
                >
                  <Text style={styles.saveText}>{saving ? 'Updating...' : 'Update Price'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ─────────────────────────────────────────────────────
  //  REGISTRATION MODE: New card or name-match
  // ─────────────────────────────────────────────────────
  const totalExistingValue = existingCards.reduce((sum, c) => sum + c.price_paid * c.quantity, 0);
  const totalQty = existingCards.reduce((sum, c) => sum + c.quantity, 0);
  const hasExisting = existingCards.length > 0;
  const lastPurchase = hasExisting ? existingCards[0] : null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>
              {hasExisting ? 'Card Recognized' : 'Card Scanned'}
            </Text>
            {scannedData && (
              <View style={styles.scanInfo}>
                <Text style={styles.cardName}>{scannedData.name || 'Unknown Card'}</Text>
                <Text style={styles.cardSet}>
                  {scannedData.set_name || 'Unknown Set'}
                  {scannedData.card_number ? ` · #${scannedData.card_number}` : ''}
                </Text>
              </View>
            )}

            {/* Previously Owned Panel */}
            {hasExisting && lastPurchase && (
              <View style={styles.existingPanel}>
                <Text style={styles.existingLabel}>Previously Owned</Text>
                <View style={styles.existingGrid}>
                  <MiniStat label="Last Paid" value={formatCurrency(lastPurchase.price_paid)} accent={Colors.accent} />
                  <MiniStat label="Total Invested" value={formatCurrency(totalExistingValue)} accent={Colors.accentBlue} />
                  <MiniStat label="Quantity" value={`×${totalQty}`} accent={Colors.warning} />
                  <MiniStat label="Condition" value={lastPurchase.condition} accent={Colors.condition[lastPurchase.condition as keyof typeof Colors.condition] || Colors.textSecondary} />
                </View>
                {existingCards.length > 1 && (
                  <View style={styles.existingList}>
                    <Text style={styles.existingListTitle}>All {existingCards.length} entries:</Text>
                    {existingCards.slice(0, 5).map(c => (
                      <View key={c.id} style={styles.existingRow}>
                        <Text style={styles.existingRowDate}>{formatDate(c.purchase_date || c.created_at)}</Text>
                        <Text style={styles.existingRowCond}>{c.condition}</Text>
                        <Text style={styles.existingRowPrice}>{formatCurrency(c.price_paid)}</Text>
                        {c.quantity > 1 && <Text style={styles.existingRowQty}>×{c.quantity}</Text>}
                      </View>
                    ))}
                  </View>
                )}
                <Text style={styles.existingHint}>Enter price for this new copy below ↓</Text>
              </View>
            )}

            {/* Price Entry */}
            <View style={styles.priceDisplay}>
              <Text style={styles.priceLabel}>Price Paid</Text>
              <View style={styles.priceRow}>
                <Text style={styles.dollarSign}>$</Text>
                <Text style={[styles.priceValue, !price && styles.pricePlaceholder]}>
                  {price || '0.00'}
                </Text>
              </View>
            </View>

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

            <View style={styles.actions}>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                <Text style={styles.clearText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, (!hasPrice || saving) && styles.saveBtnDisabled]}
                onPress={handleSaveNew}
                disabled={!hasPrice || saving}
              >
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Card'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Sub-components ──

function MiniStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={msStyles.card}>
      <Text style={[msStyles.value, { color: accent }]} numberOfLines={1}>{value}</Text>
      <Text style={msStyles.label}>{label}</Text>
    </View>
  );
}

const msStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.sm,
    padding: 10,
    alignItems: 'center',
    width: '48%',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  value: { fontSize: FontSize.md, fontWeight: '700', fontVariant: ['tabular-nums'] },
  label: { color: Colors.textMuted, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
});

// ── Styles ──

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    borderTopWidth: 1,
    borderColor: Colors.borderGlow,
    maxHeight: '90%',
  },
  title: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, textAlign: 'center', marginBottom: Spacing.sm },
  scanInfo: { alignItems: 'center', marginBottom: Spacing.md },
  cardName: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  cardSet: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 2 },
  cardRarity: { color: Colors.accentBlue, fontSize: FontSize.xs, fontWeight: '600', marginTop: 2 },

  // Found card panel (lookup mode)
  foundPanel: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  foundGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.md,
  },
  statColumn: {
    width: '50%',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  foundDetail: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foundDetailText: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  foundDetailValue: {
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // Lookup actions
  lookupActions: { marginBottom: Spacing.sm },
  addAnotherBtn: {
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accentBlue,
    alignItems: 'center',
    backgroundColor: Colors.accentBlueGlow,
  },
  addAnotherText: { color: Colors.accentBlue, fontSize: FontSize.md, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.md },
  updateLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, textAlign: 'center', marginBottom: Spacing.sm },

  // Existing panel (registration mode)
  existingPanel: {
    backgroundColor: Colors.bg + '80',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accentGlow,
  },
  existingLabel: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm, textAlign: 'center' },
  existingGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  existingList: { marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  existingListTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', marginBottom: 4 },
  existingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3, gap: 8 },
  existingRowDate: { color: Colors.textMuted, fontSize: 10, width: 70 },
  existingRowCond: { color: Colors.textSecondary, fontSize: 10, flex: 1 },
  existingRowPrice: { color: Colors.accent, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  existingRowQty: { color: Colors.textMuted, fontSize: 10, width: 22 },
  existingHint: { color: Colors.textMuted, fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.sm },

  // Price display
  priceDisplay: { alignItems: 'center', marginBottom: Spacing.lg, backgroundColor: Colors.bgInput, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.accentGlow },
  priceLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 4 },
  dollarSign: { color: Colors.textSecondary, fontSize: FontSize.xl, fontWeight: '600', marginRight: 2 },
  priceValue: { color: Colors.accent, fontSize: FontSize.hero, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pricePlaceholder: { color: Colors.textMuted },

  // Keypad
  keypad: { gap: Spacing.sm, marginBottom: Spacing.lg },
  keypadRow: { flexDirection: 'row', gap: Spacing.sm },
  key: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  keyBackspace: { backgroundColor: Colors.border },
  keyText: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '600' },
  keyTextBackspace: { fontSize: FontSize.lg, color: Colors.textSecondary },

  // Actions
  actions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  clearBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  clearText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: Colors.textMuted, fontSize: FontSize.md },
});
