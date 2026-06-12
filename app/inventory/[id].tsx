import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, Image, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency, formatDate } from '../../utils/format';
import { getCardById, updateCard, deleteCard, Card } from '../../database';
import { LoadingState, ErrorState } from '../../components/EmptyState';
import { PrintLabelModal } from '../../components/PrintLabelModal';
import { DatePickerField } from '../../components/DatePickerField';
import * as ImagePicker from 'expo-image-picker';

const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Good', 'Light Played', 'Played', 'Poor'];

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [editName, setEditName] = useState('');
  const [editSetName, setEditSetName] = useState('');
  const [editCardNumber, setEditCardNumber] = useState('');
  const [editRarity, setEditRarity] = useState('');
  const [editCondition, setEditCondition] = useState('Near Mint');
  const [editPricePaid, setEditPricePaid] = useState('');
  const [editPriceTarget, setEditPriceTarget] = useState('');
  const [editPriceSold, setEditPriceSold] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editDataMatrix, setEditDataMatrix] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  useEffect(() => {
    loadCard();
  }, [id]);

  async function loadCard() {
    try {
      const data = await getCardById(Number(id));
      if (!data) {
        setError('Card not found');
      } else {
        setCard(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEditing() {
    if (!card) return;
    setEditName(card.name);
    setEditSetName(card.set_name);
    setEditCardNumber(card.card_number ?? '');
    setEditRarity(card.rarity ?? '');
    setEditCondition(card.condition);
    setEditPricePaid(card.price_paid.toString());
    setEditPriceTarget((card.price_target ?? 0).toString());
    setEditPriceSold((card.price_sold ?? 0).toString());
    setEditQuantity(card.quantity.toString());
    setEditPurchaseDate(card.purchase_date ?? '');
    setEditDataMatrix(card.data_matrix ?? '');
    setEditTags(card.tags ?? '');
    setEditNotes(card.notes ?? '');
    setEditDescription(card.description ?? '');
    setEditImageUri(card.image_uri ?? null);
    setEditing(true);
  }

  async function saveEdits() {
    if (!card) return;
    try {
      await updateCard(card.id, {
        name: editName,
        set_name: editSetName,
        card_number: editCardNumber || undefined,
        rarity: editRarity || undefined,
        condition: editCondition,
        price_paid: parseFloat(editPricePaid) || 0,
        price_target: parseFloat(editPriceTarget) || 0,
        price_sold: parseFloat(editPriceSold) || 0,
        quantity: parseInt(editQuantity, 10) || 1,
        purchase_date: editPurchaseDate || undefined,
        data_matrix: editDataMatrix || undefined,
        tags: editTags || undefined,
        notes: editNotes || undefined,
        description: editDescription || undefined,
        image_uri: editImageUri || undefined,
      });
      setEditing(false);
      loadCard();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Card',
      'Are you sure you want to delete this card? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCard(Number(id));
              router.back();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  if (loading) return <LoadingState message="Loading card..." />;
  if (error) return <ErrorState message={error} onRetry={loadCard} />;
  if (!card) return <ErrorState message="Card not found" />;

  const conditionColor = Colors.condition[card.condition as keyof typeof Colors.condition] || Colors.textSecondary;
  const totalValue = card.price_paid * card.quantity;

  if (editing) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.editContent}>
        <Text style={styles.editTitle}>Edit Card</Text>

        <Field label="Card Name" value={editName} onChange={setEditName} />
        <Field label="Set" value={editSetName} onChange={setEditSetName} />
        <Field label="Card Number" value={editCardNumber} onChange={setEditCardNumber} />
        <Field label="Rarity" value={editRarity} onChange={setEditRarity} />

        <Text style={styles.fieldLabel}>Condition</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.condScroll}>
          {CONDITIONS.map(c => (
            <TouchableOpacity
              key={c}
              style={[styles.condChip, editCondition === c && styles.condChipActive]}
              onPress={() => setEditCondition(c)}
            >
              <Text style={[styles.condChipText, editCondition === c && styles.condChipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Field label="Price Paid ($)" value={editPricePaid} onChange={setEditPricePaid} keyboardType="decimal-pad" />
        <Field label="Price Target ($)" value={editPriceTarget} onChange={setEditPriceTarget} keyboardType="decimal-pad" />
        <Field label="Price Sold ($)" value={editPriceSold} onChange={setEditPriceSold} keyboardType="decimal-pad" />
        <Field label="Quantity" value={editQuantity} onChange={setEditQuantity} keyboardType="number-pad" />
        <DatePickerField label="Purchase Date" value={editPurchaseDate} onChange={setEditPurchaseDate} />
        <Field label="DataMatrix Code" value={editDataMatrix} onChange={setEditDataMatrix} />
        <Field label="Tags (comma-separated)" value={editTags} onChange={setEditTags} />
        <Field label="Notes" value={editNotes} onChange={setEditNotes} multiline />
        <Field label="Description" value={editDescription} onChange={setEditDescription} multiline placeholder="Card description, flavor text, distinguishing marks..." />

        <Text style={styles.fieldLabel}>Card Image</Text>
        {editImageUri ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
            <Image source={{ uri: editImageUri }} style={{ width: 100, height: 100, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.border }} resizeMode="cover" />
            <TouchableOpacity onPress={() => setEditImageUri(null)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: Colors.danger + '44' }}>
              <Text style={{ color: Colors.danger, fontSize: FontSize.sm }}>Remove</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md }}>
            <TouchableOpacity style={styles.imageBtn} onPress={async () => {
              const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (!result.canceled && result.assets[0]) setEditImageUri(result.assets[0].uri);
            }}>
              <Text style={{ fontSize: 18 }}>📷</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={async () => {
              const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
              if (!result.canceled && result.assets[0]) setEditImageUri(result.assets[0].uri);
            }}>
              <Text style={{ fontSize: 18 }}>🖼</Text>
              <Text style={{ color: Colors.textSecondary, fontSize: FontSize.sm }}>Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.editActions}>
          <TouchableOpacity style={styles.cancelEditBtn} onPress={() => setEditing(false)}>
            <Text style={styles.cancelEditText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveEditBtn} onPress={saveEdits}>
            <Text style={styles.saveEditText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header Card */}
      <View style={[styles.headerCard, { borderColor: conditionColor + '40' }]}>
        <View style={styles.conditionRow}>
          <View style={[styles.conditionDot, { backgroundColor: conditionColor }]} />
          <Text style={[styles.conditionText, { color: conditionColor }]}>{card.condition}</Text>
        </View>
        <Text style={styles.cardName}>{card.name}</Text>
        <Text style={styles.setName}>{card.set_name}</Text>
        {card.card_number && <Text style={styles.cardNumber}>#{card.card_number}</Text>}
        {card.rarity && <Text style={styles.rarity}>{card.rarity}</Text>}
      </View>

      {/* Financials */}
      <View style={styles.financeSection}>
        <View style={styles.financeRow}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Price Paid</Text>
            <Text style={styles.financeValue}>{formatCurrency(card.price_paid)}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Quantity</Text>
            <Text style={styles.financeValue}>{card.quantity}</Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Total Cost</Text>
            <Text style={[styles.financeValue, styles.totalValue]}>{formatCurrency(totalValue)}</Text>
          </View>
        </View>

        {/* Price Target & Sold */}
        <View style={[styles.financeRow, { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border }]}>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Target</Text>
            <Text style={[styles.financeValue, { color: Colors.warning }]}>
              {(card.price_target ?? 0) > 0 ? formatCurrency(card.price_target) : '—'}
            </Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Sold At</Text>
            <Text style={[styles.financeValue, { color: Colors.success }]}>
              {(card.price_sold ?? 0) > 0 ? formatCurrency(card.price_sold) : '—'}
            </Text>
          </View>
          <View style={styles.financeItem}>
            <Text style={styles.financeLabel}>Spread</Text>
            <Text style={[styles.financeValue, { color: (card.price_target ?? 0) > (card.price_paid ?? 0) ? Colors.success : Colors.danger }]}>
              {(card.price_target ?? 0) > 0
                ? formatCurrency((card.price_target ?? 0) - card.price_paid)
                : '—'}
            </Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailSection}>
        <DetailRow label="Purchase Date" value={formatDate(card.purchase_date)} />
        <DetailRow label="Added" value={formatDate(card.created_at)} />
        <DetailRow label="Updated" value={formatDate(card.updated_at)} />
        <DetailRow label="Days in Inventory" value={(() => {
          const days = Math.floor((Date.now() - new Date(card.created_at).getTime()) / (1000 * 60 * 60 * 24));
          return `${days} day${days !== 1 ? 's' : ''}`;
        })()} />
        {card.data_matrix ? (
          <DetailRow label="DataMatrix" value={card.data_matrix} />
        ) : null}
        {card.tags ? <DetailRow label="Tags" value={card.tags} /> : null}
        {card.description ? <DetailRow label="Description" value={card.description} /> : null}
        <DetailRow label="DB ID" value={`#${card.id}`} />
        {card.notes ? <DetailRow label="Notes" value={card.notes} /> : null}
      </View>

      {card.image_uri ? (
        <TouchableOpacity style={{ marginTop: Spacing.md }} onPress={() => setShowImagePreview(true)}>
          <Image source={{ uri: card.image_uri }} style={{ width: '100%', height: 240, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.borderGlow }} resizeMode="contain" />
        </TouchableOpacity>
      ) : null}

      {/* Actions */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.editBtn} onPress={startEditing}>
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Print Label */}
      <TouchableOpacity style={styles.printLabelBtn} onPress={() => setShowPrintModal(true)}>
        <Text style={styles.printLabelBtnText}>🖨 Print DataMatrix Label</Text>
      </TouchableOpacity>

      <PrintLabelModal
        visible={showPrintModal}
        card={card}
        onClose={() => setShowPrintModal(false)}
      />

      <Modal visible={showImagePreview} transparent animationType="fade">
        <TouchableOpacity style={styles.imagePreviewOverlay} onPress={() => setShowImagePreview(false)} activeOpacity={1}>
          <Image source={{ uri: card.image_uri! }} style={styles.imagePreviewFull} resizeMode="contain" />
          <Text style={styles.imagePreviewClose}>Tap to close</Text>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

// Helper sub-components

function Field({ label, value, onChange, keyboardType, multiline, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; keyboardType?: any; multiline?: boolean; placeholder?: string;
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={detailStyles.row}>
      <Text style={detailStyles.label}>{label}</Text>
      <Text style={detailStyles.value}>{value}</Text>
    </View>
  );
}

const detailStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  label: { color: Colors.textMuted, fontSize: FontSize.sm },
  value: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md, paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg, paddingBottom: Spacing.xxl },
  editContent: { padding: Spacing.md, paddingTop: Platform.OS === 'ios' ? 60 : Spacing.lg, paddingBottom: Spacing.xxl },
  editTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.lg },

  // Header card
  headerCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'center',
    gap: 4,
  },
  conditionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },
  conditionText: { fontSize: FontSize.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  cardName: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  setName: { color: Colors.textSecondary, fontSize: FontSize.md },
  cardNumber: { color: Colors.textMuted, fontSize: FontSize.sm },
  rarity: { color: Colors.accentBlue, fontSize: FontSize.sm, fontWeight: '600', marginTop: 4 },

  // Financials
  financeSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  financeRow: { flexDirection: 'row' },
  financeItem: { flex: 1, alignItems: 'center' },
  financeLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  financeValue: { color: Colors.accent, fontSize: FontSize.lg, fontWeight: '700', marginTop: 4 },
  totalValue: { color: Colors.accentBlue },

  // Details
  detailSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },

  // Actions
  actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  editBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  editBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },
  deleteBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.danger, alignItems: 'center' },
  deleteBtnText: { color: Colors.danger, fontSize: FontSize.md, fontWeight: '600' },

  // Edit mode condition chips
  fieldLabel: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  condScroll: { marginBottom: Spacing.md },
  condChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.xl, backgroundColor: Colors.bgInput, borderWidth: 1, borderColor: Colors.border, marginRight: 8 },
  condChipActive: { backgroundColor: Colors.accentGlow, borderColor: Colors.accent },
  condChipText: { color: Colors.textSecondary, fontSize: FontSize.sm, fontWeight: '500' },
  condChipTextActive: { color: Colors.accent, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  cancelEditBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelEditText: { color: Colors.textSecondary, fontSize: FontSize.md, fontWeight: '600' },
  saveEditBtn: { flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  saveEditText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },
  printLabelBtn: {
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.accent,
    alignItems: 'center',
    marginTop: Spacing.sm,
    backgroundColor: Colors.accentGlow,
  },
  printLabelBtnText: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  imageBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  imagePreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imagePreviewFull: { width: '90%', height: '80%' },
  imagePreviewClose: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing.md },
});
