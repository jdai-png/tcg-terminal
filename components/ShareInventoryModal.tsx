import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { SvgXml } from 'react-native-svg';
import { Colors, FontSize, Spacing, BorderRadius } from '../utils/format';
import { getAllCards, Card } from '../database';
import bwipjs from 'bwip-js';

interface ShareInventoryModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ShareInventoryModal({ visible, onClose }: ShareInventoryModalProps) {
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardCount, setCardCount] = useState(0);

  useEffect(() => {
    if (visible) {
      generateQR();
    }
  }, [visible]);

  const generateQR = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get all non-archived cards
      const allCards = await getAllCards({ includeArchived: false });

      // Sanitize: only share public info (no cost data)
      const shareData = {
        type: 'tcg_share',
        version: 1,
        app: 'TCG Terminal',
        cards: allCards.map(c => ({
          name: c.name,
          set_name: c.set_name,
          card_number: c.card_number,
          rarity: c.rarity,
          condition: c.condition,
          price_target: c.price_target || 0,
          tags: c.tags,
        })),
      };

      const json = JSON.stringify(shareData);

      // Generate QR code using bwip-js (returns SVG markup string)
      const svg = bwipjs.toSVG({
        bcid: 'qrcode',
        text: json,
        scale: 3,
        height: 15,
        width: 15,
        includetext: false,
      });

      setQrSvg(svg);
      setCardCount(allCards.length);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to generate QR code');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Share Inventory</Text>
          <Text style={styles.subtitle}>
            {cardCount} card{cardCount !== 1 ? 's' : ''} · QR Code
          </Text>

          {/* QR Code */}
          <View style={styles.qrBox}>
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={Colors.accent} />
                <Text style={styles.loadingText}>Generating QR...</Text>
              </View>
            )}
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            {qrSvg && !loading && (
              <SvgXml xml={qrSvg} width="100%" height="100%" />
            )}
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How it works</Text>
            <Text style={styles.infoText}>
              Scan this QR code with any TCG Terminal scanner to view a read-only list. Only public card info is shared — no cost data or purchase history.
            </Text>
          </View>

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: Colors.borderGlow,
    alignItems: 'center',
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
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  qrBox: {
    width: 250,
    height: 250,
    backgroundColor: '#ffffff',
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    textAlign: 'center',
    padding: Spacing.sm,
  },
  infoBox: {
    backgroundColor: Colors.accentGlow,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
    width: '100%',
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
  closeBtn: {
    marginTop: Spacing.lg,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
  },
  closeText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
