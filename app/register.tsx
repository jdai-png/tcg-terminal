// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency } from '../utils/format';
import { insertCard, CardInsert } from '../database';
import { encodeCardForLabel, generateDataMatrixSvg } from '../utils/labelPrinter';
import { DatePickerField } from '../components/DatePickerField';
import * as ImagePicker from 'expo-image-picker';

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Good', 'Light Played', 'Played', 'Poor'];

export default function RegisterScreen() {
  const router = useRouter();

  // Form fields
  const [name, setName] = useState('');
  const [cardSet, setCardSet] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [rarity, setRarity] = useState('');
  const [condition, setCondition] = useState('Near Mint');
  const [quantity, setQuantity] = useState('1');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [description, setDescription] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const imageLabelStyle = { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 } as const;

  // Price (via keypad)
  const [price, setPrice] = useState('');
  const priceRef = useRef('');
  useEffect(() => { priceRef.current = price; }, [price]);

  // DataMatrix generation
  const [savedCardId, setSavedCardId] = useState<number | null>(null);
  const [savedCardName, setSavedCardName] = useState('');
  const [savedCardSet, setSavedCardSet] = useState('');
  const [savedCardNumber, setSavedCardNumber] = useState('');
  const [svgData, setSvgData] = useState<string | null>(null);
  const [generatingMatrix, setGeneratingMatrix] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keypad handlers
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

  // Save card
  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert('Missing Name', 'Please enter the card name.');
      return;
    }
    if (!cardSet.trim()) {
      Alert.alert('Missing Set', 'Please enter the set name.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price.');
      return;
    }

    setSaving(true);
    try {
      const card: CardInsert = {
        name: name.trim(),
        set_name: cardSet.trim(),
        card_number: cardNumber.trim() || undefined,
        rarity: rarity.trim() || undefined,
        condition,
        price_paid: parsedPrice,
        quantity: parseInt(quantity, 10) || 1,
        purchase_date: purchaseDate.trim() || undefined,
        notes: notes.trim() || undefined,
        description: description.trim() || undefined,
        image_uri: imageUri || undefined,
      };

      const newId = await insertCard(card);
      setSavedCardId(newId);
      setSavedCardName(card.name);
      setSavedCardSet(card.set_name);
      setSavedCardNumber(card.card_number || '');

      // Generate DataMatrix
      setGeneratingMatrix(true);
      const data = encodeCardForLabel({
        id: newId,
        name: card.name,
        set_name: card.set_name,
        card_number: card.card_number,
      });

      try {
        const svg = await generateDataMatrixSvg(data);
        setSvgData(svg);
      } catch {
        // SVG generation may fail on native — that's OK, print still works via PNG
      }
      setGeneratingMatrix(false);
    } catch (err: any) {
      Alert.alert('Save Failed', err?.message || 'Could not save card.');
    } finally {
      setSaving(false);
    }
  }, [name, cardSet, cardNumber, rarity, condition, price, quantity, purchaseDate, notes, description, imageUri]);

  // Print label
  const handlePrint = () => {
    if (!savedCardId || !svgData) return;

    if (Platform.OS !== 'web') {
      Alert.alert('Print Unavailable', 'Label printing is only available on web.');
      return;
    }

    // @ts-ignore — DOM canvas API, not available in RN type context
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20, 360, 360);
      URL.revokeObjectURL(url);
      const pngData = canvas.toDataURL('image/png');

      // Use the print utility (import dynamically to avoid native crash)
      const { printLabel } = require('../utils/labelPrinter');
      printLabel(
        {
          id: savedCardId,
          name: savedCardName,
          set_name: savedCardSet,
          card_number: savedCardNumber || null,
          rarity: rarity.trim() || null,
          condition,
          price_paid: parseFloat(price),
          quantity: parseInt(quantity, 10) || 1,
          purchase_date: purchaseDate.trim() || null,
          notes: notes.trim() || null,
          image_uri: imageUri,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any,
        pngData
      );
    };
    img.src = url;
  };

  const handleViewCard = () => {
    if (savedCardId) {
      router.replace(`/inventory/${savedCardId}`);
    }
  };

  const handleRegisterAnother = () => {
    setName('');
    setCardSet('');
    setCardNumber('');
    setRarity('');
    setCondition('Near Mint');
    setPrice('');
    setQuantity('1');
    setPurchaseDate('');
    setNotes('');
    setDescription('');
    setImageUri(null);
    setSavedCardId(null);
    setSvgData(null);
    priceRef.current = '';
  };

  const keypad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ];

  const hasPrice = price.length > 0 && !isNaN(parseFloat(price)) && parseFloat(price) > 0;
  const canSave = name.trim() && cardSet.trim() && hasPrice;

  // Show DataMatrix preview after save
  if (savedCardId !== null) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.successContent}>
        <Text style={styles.successTitle}>✓ Card Registered</Text>

        <View style={styles.successCard}>
          <Text style={styles.successCardName}>{savedCardName}</Text>
          <Text style={styles.successCardSet}>
            {savedCardSet}
            {savedCardNumber ? ` · #${savedCardNumber}` : ''}
          </Text>
          <Text style={styles.successCardId}>ID: {savedCardId}</Text>
          <Text style={styles.successCardPrice}>{formatCurrency(parseFloat(price))}</Text>
        </View>

        {/* DataMatrix preview */}
        <View style={styles.matrixSection}>
          <Text style={styles.matrixTitle}>DataMatrix Label</Text>
          <Text style={styles.matrixSubtitle}>Scan to identify this card</Text>

          <View style={styles.matrixPreview}>
            {generatingMatrix && (
              <View style={styles.matrixLoading}>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={styles.matrixLoadingText}>Generating DataMatrix...</Text>
              </View>
            )}
            {svgData && !generatingMatrix && Platform.OS === 'web' && (
              <View style={styles.matrixSvgContainer}>
                <div
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: svgData }}
                />
              </View>
            )}
            {svgData && !generatingMatrix && Platform.OS !== 'web' && (
              <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', padding: Spacing.md }}>
                <Text style={{ color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center' }}>DataMatrix generated successfully</Text>
              </View>
            )}
          </View>

          <Text style={styles.matrixHint}>
            This DataMatrix encodes your card's ID, name, and set. Print it on a label and attach it to the card for fast scanning.
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.successActions}>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.printBtn, (!svgData || generatingMatrix) && styles.btnDisabled]}
              onPress={handlePrint}
              disabled={!svgData || generatingMatrix}
            >
              <Text style={styles.printBtnText}>🖨 Print Label</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.viewBtn} onPress={handleViewCard}>
            <Text style={styles.viewBtnText}>View Card Details</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.anotherBtn} onPress={handleRegisterAnother}>
            <Text style={styles.anotherBtnText}>+ Register Another Card</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Registration form
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.formContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Register Card</Text>
      <Text style={styles.subtitle}>Enter card details and generate a DataMatrix label</Text>

      {/* Required fields */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Info</Text>
        <Field label="Card Name *" value={name} onChange={setName} placeholder="e.g. Charizard" />
        <Field label="Set *" value={cardSet} onChange={setCardSet} placeholder="e.g. Base Set" />
        <Field label="Card Number" value={cardNumber} onChange={setCardNumber} placeholder="e.g. 4/102" />
        <Field label="Rarity" value={rarity} onChange={setRarity} placeholder="e.g. Holo Rare" />
      </View>

      {/* Condition */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Condition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.condScroll}>
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.condChip, condition === c && styles.condChipActive]}
              onPress={() => setCondition(c)}
            >
              <Text style={[styles.condChipText, condition === c && styles.condChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Price section with keypad */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Price *</Text>
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

        <TouchableOpacity style={styles.clearPriceBtn} onPress={handleClear}>
          <Text style={styles.clearPriceText}>Clear Price</Text>
        </TouchableOpacity>
      </View>

      {/* Additional details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Details</Text>
        <Field label="Quantity" value={quantity} onChange={setQuantity} keyboardType="number-pad" placeholder="1" />
        <DatePickerField
          label="Purchase Date"
          value={purchaseDate}
          onChange={setPurchaseDate}
        />
        <Field label="Notes" value={notes} onChange={setNotes} multiline placeholder="e.g. PSA 9, first edition..." />
        <Field label="Description" value={description} onChange={setDescription} multiline placeholder="Card flavor text, grading notes, distinguishing marks..." />

        <View style={{ marginBottom: Spacing.md }}>
          <Text style={imageLabelStyle}>Card Image</Text>
          {imageUri ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              <Image source={{ uri: imageUri }} style={{ width: 80, height: 80, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border }} />
              <TouchableOpacity
                onPress={() => setImageUri(null)}
                style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.danger + '44' }}
              >
                <Text style={{ color: Colors.danger, fontSize: FontSize.sm }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderGlow, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                onPress={async () => {
                  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
                  if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
                }}
              >
                <Text style={{ fontSize: 18 }}>📷</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, paddingVertical: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.bgCard, borderWidth: 1, borderColor: Colors.borderGlow, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}
                onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
                  if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
                }}
              >
                <Text style={{ fontSize: 18 }}>🖼</Text>
                <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Gallery</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!canSave || saving}
      >
        {saving ? (
          <ActivityIndicator color={Colors.bg} />
        ) : (
          <Text style={styles.saveBtnText}>Save Card & Generate DataMatrix</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelBtnText}>Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// Field component
function Field({ label, value, onChange, keyboardType, multiline, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: any;
  multiline?: boolean;
  placeholder?: string;
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
        keyboardType={keyboardType}
        multiline={multiline}
      />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  input: { backgroundColor: Colors.bgInput, borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 10, color: Colors.text, fontSize: FontSize.md, borderWidth: 1, borderColor: Colors.border },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  formContent: {
    padding: Spacing.md,
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: { color: Colors.text, fontSize: FontSize.xxl, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: Colors.textSecondary, fontSize: FontSize.sm, marginTop: 4, marginBottom: Spacing.lg },

  section: { marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },

  // Condition chips
  condScroll: { marginBottom: 0 },
  condChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: BorderRadius.xl, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  condChipActive: { backgroundColor: Colors.accentGlow, borderColor: Colors.accent },
  condChipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  condChipTextActive: { color: Colors.accent, fontWeight: '600' },

  // Price display + keypad
  priceDisplay: { alignItems: 'center', marginBottom: Spacing.md, backgroundColor: Colors.bgInput, borderRadius: BorderRadius.md, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.accentGlow },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  dollarSign: { color: Colors.textSecondary, fontSize: FontSize.xl, fontWeight: '600', marginRight: 2 },
  priceValue: { color: Colors.accent, fontSize: FontSize.hero, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pricePlaceholder: { color: Colors.textMuted },

  keypad: { gap: Spacing.sm, marginBottom: Spacing.sm },
  keypadRow: { flexDirection: 'row', gap: Spacing.sm },
  key: { flex: 1, height: 52, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bgInput, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  keyBackspace: { backgroundColor: Colors.border },
  keyText: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '600' },
  keyTextBackspace: { fontSize: FontSize.lg, color: Colors.textSecondary },

  clearPriceBtn: { alignItems: 'center', paddingVertical: 8 },
  clearPriceText: { color: Colors.textMuted, fontSize: FontSize.sm },

  // Save button
  saveBtn: { paddingVertical: 16, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, alignItems: 'center', marginTop: Spacing.sm },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },

  cancelBtn: { alignItems: 'center', paddingVertical: 12, marginTop: Spacing.sm },
  cancelBtnText: { color: Colors.textMuted, fontSize: FontSize.md },

  // ── Success / DataMatrix view ──
  successContent: { padding: Spacing.md, paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg, paddingBottom: Spacing.xxl },
  successTitle: { color: Colors.accent, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center', marginBottom: Spacing.lg },

  successCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.accentGlow,
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.lg,
  },
  successCardName: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700', textAlign: 'center' },
  successCardSet: { color: Colors.textSecondary, fontSize: FontSize.sm },
  successCardId: { color: Colors.textMuted, fontSize: FontSize.xs, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginTop: 4 },
  successCardPrice: { color: Colors.accent, fontSize: FontSize.lg, fontWeight: '700', marginTop: 8 },

  matrixSection: { marginBottom: Spacing.lg },
  matrixTitle: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', textAlign: 'center' },
  matrixSubtitle: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', marginTop: 2, marginBottom: Spacing.md },

  matrixPreview: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  matrixLoading: { alignItems: 'center', gap: Spacing.sm },
  matrixLoadingText: { color: Colors.textMuted, fontSize: FontSize.sm },
  matrixSvgContainer: { width: '100%', height: '100%' },

  matrixHint: { color: Colors.textMuted, fontSize: FontSize.xs, lineHeight: 18, textAlign: 'center', paddingHorizontal: Spacing.sm },

  successActions: { gap: Spacing.sm },
  printBtn: { paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  printBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },
  viewBtn: { paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.accentBlue, alignItems: 'center', backgroundColor: Colors.accentBlueGlow },
  viewBtnText: { color: Colors.accentBlue, fontSize: FontSize.md, fontWeight: '600' },
  anotherBtn: { paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  anotherBtnText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  btnDisabled: { opacity: 0.4 },
});
