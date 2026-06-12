import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Platform, AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Colors, FontSize, Spacing, BorderRadius } from '../utils/format';
import { QuickAddOverlay } from '../components/QuickAddOverlay';
import { ErrorState } from '../components/EmptyState';
import { findCardsByScanData, Card, getCardById } from '../database';

interface ScannedCard {
  name: string;
  set_name: string;
  card_number?: string;
  dbId?: number;
}

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<ScannedCard | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [existingCards, setExistingCards] = useState<Card[]>([]);
  const [foundCard, setFoundCard] = useState<Card | null>(null);
  const lastScanRef = useRef<string | null>(null);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset scanning state when screen comes back into focus
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setIsScanning(true);
        lastScanRef.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const handleBarCodeScanned = useCallback(async (result: BarcodeScanningResult) => {
    if (!isScanning) return;

    // Deduplicate: prevent rapid duplicate scans
    if (result.data === lastScanRef.current) return;
    lastScanRef.current = result.data;

    try {
      // Parse scanned data — look for 'id' field for direct lookup
      let cardData: ScannedCard;

      // Check if this is a shared inventory QR
      let sharedInventory: any = null;
      if (result.data.startsWith('{')) {
        try {
          const parsed = JSON.parse(result.data);
          if (parsed.type === 'tcg_share' && parsed.cards) {
            sharedInventory = parsed;
          }
        } catch {}
      }

      if (result.data.startsWith('{')) {
        const parsed = JSON.parse(result.data);
        cardData = {
          name: parsed.name || parsed.card_name || 'Unknown Card',
          set_name: parsed.set_name || parsed.set || 'Unknown Set',
          card_number: parsed.card_number || parsed.number,
          dbId: parsed.id ? Number(parsed.id) : undefined,
        };
      } else if (result.data.includes('|')) {
        const parts = result.data.split('|');
        cardData = {
          name: parts[0]?.trim() || 'Unknown Card',
          set_name: parts[1]?.trim() || 'Unknown Set',
          card_number: parts[2]?.trim(),
        };
      } else {
        cardData = {
          name: result.data.trim(),
          set_name: '',
        };
      }

      if (sharedInventory) {
        setIsScanning(false);
        const cardList = sharedInventory.cards as any[];
        const summary = cardList.slice(0, 10).map((c: any) => `• ${c.name} (${c.set_name})${c.price_target ? ` — $${c.price_target}` : ''}`).join('\n');
        const more = cardList.length > 10 ? `\n... and ${cardList.length - 10} more` : '';
        Alert.alert(
          `📋 Shared Inventory — ${cardList.length} cards`,
          summary + more,
          [
            { text: 'Dismiss', onPress: () => { lastScanRef.current = null; setIsScanning(true); } },
          ]
        );
        return;
      }

      setIsScanning(false);
      setScanned(cardData);

      // If we have a DB ID, do a direct lookup first
      if (cardData.dbId) {
        const exact = await getCardById(cardData.dbId);
        if (exact) {
          setFoundCard(exact);
          setExistingCards([]);
        } else {
          // ID not found (deleted?), fall back to name lookup
          setFoundCard(null);
          findCardsByScanData(cardData.name, cardData.set_name, cardData.card_number)
            .then(setExistingCards).catch(() => setExistingCards([]));
        }
      } else {
        setFoundCard(null);
        findCardsByScanData(cardData.name, cardData.set_name, cardData.card_number)
          .then(setExistingCards).catch(() => setExistingCards([]));
      }
      setShowOverlay(true);
      setScanError(null);

      // Re-enable scanning after overlay closes
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    } catch {
      setScanError('Could not parse card data. Try scanning again.');
      // Allow rescan after short delay
      scanTimeoutRef.current = setTimeout(() => {
        lastScanRef.current = null;
        setScanError(null);
      }, 2000);
    }
  }, [isScanning]);

  const handleOverlayClose = () => {
    setShowOverlay(false);
    setScanned(null);
    setExistingCards([]);
    setFoundCard(null);
    lastScanRef.current = null;
    // Brief delay before allowing new scans
    setTimeout(() => {
      setIsScanning(true);
    }, 500);
  };

  const handleCardSaved = () => {
    // Card was saved - handled by overlay
  };

  // Permission states
  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.waitingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <ErrorState
          message="Camera access is required to scan cards."
          onRetry={requestPermission}
        />
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['datamatrix'],
        }}
        onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
      />

      {/* Scan overlay */}
      <View style={styles.overlay}>
        {/* Viewfinder */}
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <Text style={styles.scanHint}>
          {scanError || 'Align QR or DataMatrix code within frame'}
        </Text>

        {scanError && (
          <Text style={styles.scanError}>{scanError}</Text>
        )}
      </View>

      {/* Register & Quick-Add buttons */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.registerBtn}
          onPress={() => router.push('/register')}
        >
          <Text style={styles.registerBtnText}>＋ Register Card</Text>
          <Text style={styles.registerBtnHint}>Full form + DataMatrix</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => {
            setScanned({ name: '', set_name: '' });
            setExistingCards([]);
            setFoundCard(null);
            setShowOverlay(true);
          }}
        >
          <Text style={styles.manualBtnText}>Quick Price</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Add Overlay */}
      <QuickAddOverlay
        visible={showOverlay}
        scannedData={scanned}
        foundCard={foundCard}
        existingCards={existingCards}
        onClose={handleOverlayClose}
        onSaved={handleCardSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: Colors.accent,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 6,
  },
  scanHint: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginTop: Spacing.lg,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  scanError: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  bottomActions: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: Spacing.md,
    right: Spacing.md,
    gap: Spacing.sm,
  },
  registerBtn: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  registerBtnText: {
    color: Colors.bg,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  registerBtnHint: {
    color: Colors.bg + '99',
    fontSize: FontSize.xs,
  },
  manualBtn: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.borderGlow,
  },
  manualBtnText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  waitingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  permBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.accent,
  },
  permBtnText: {
    color: Colors.bg,
    fontWeight: '700',
  },
});
