import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius, formatCurrency } from '../utils/format';
import { Card } from '../database';
import { generateDataMatrixSvg, encodeCardForLabel, printLabel } from '../utils/labelPrinter';

interface PrintLabelModalProps {
  visible: boolean;
  card: Card | null;
  onClose: () => void;
}

export function PrintLabelModal({ visible, card, onClose }: PrintLabelModalProps) {
  const [svgData, setSvgData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && card) {
      setLoading(true);
      setError(null);
      const data = encodeCardForLabel({
        id: card.id,
        name: card.name,
        set_name: card.set_name,
        card_number: card.card_number || undefined,
      });

      generateDataMatrixSvg(data)
        .then(svg => {
          setSvgData(svg);
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to generate barcode');
          setLoading(false);
        });
    }
  }, [visible, card]);

  const handlePrint = () => {
    if (!card || !svgData) return;

    // Convert SVG to a PNG data URL via canvas (needed for print window img tag)
    if (Platform.OS === 'web') {
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
        printLabel(card, pngData);
      };
      img.src = url;
    }
  };

  if (!card) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Print Label</Text>
            <Text style={styles.subtitle}>NK_P21 · 74×124mm</Text>

            {/* Card info */}
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>{card.name}</Text>
              <Text style={styles.cardSet}>
                {card.set_name}
                {card.card_number ? ` · #${card.card_number}` : ''}
              </Text>
              {card.rarity && <Text style={styles.cardRarity}>{card.rarity}</Text>}
              <View style={styles.cardMeta}>
                <Text style={styles.cardCond}>{card.condition}</Text>
                <Text style={styles.cardPrice}>{formatCurrency(card.price_paid)}</Text>
              </View>
              <Text style={styles.cardId}>ID: {card.id} · TCG Terminal</Text>
            </View>

            {/* Barcode preview */}
            <View style={styles.previewBox}>
              {loading && (
                <View style={styles.previewLoading}>
                  <ActivityIndicator color={Colors.accent} />
                  <Text style={styles.previewLoadingText}>Generating DataMatrix...</Text>
                </View>
              )}
              {error && (
                <Text style={styles.previewError}>{error}</Text>
              )}
              {svgData && !loading && (
                <div
                  style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  dangerouslySetInnerHTML={{ __html: svgData }}
                />
              )}
            </View>

            {/* Info */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoText}>
                This DataMatrix contains your card's unique ID, name, and set. Scanning it with any QR/DataMatrix reader (including this app) will instantly identify the card and show your saved price.
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.printBtn, (!svgData || loading) && styles.printBtnDisabled]}
                onPress={handlePrint}
                disabled={!svgData || loading}
              >
                <Text style={styles.printText}>🖨 Print Label</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  modal: {
    backgroundColor: Colors.bgCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Card info
  cardInfo: {
    backgroundColor: Colors.bgInput,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardSet: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  cardRarity: {
    color: Colors.accentBlue,
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    alignItems: 'center',
  },
  cardCond: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
  },
  cardPrice: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  cardId: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },

  // Preview
  previewBox: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  previewLoading: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  previewLoadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  previewError: {
    color: Colors.danger,
    fontSize: FontSize.sm,
  },

  // Info
  infoBox: {
    backgroundColor: Colors.accentGlow,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  infoTitle: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    marginTop: 4,
    lineHeight: 16,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  printBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  printBtnDisabled: {
    opacity: 0.4,
  },
  printText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
