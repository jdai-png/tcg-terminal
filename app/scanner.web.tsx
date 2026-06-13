import { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, formatCurrency } from '../utils/format';
import { DexColors, DexStyles } from '../utils/pokedex-theme';
import { QuickAddOverlay } from '../components/QuickAddOverlay';
import { findCardsByScanData, Card, getCardById, findCardByDataMatrix } from '../database';
import { playItemFoundSound } from '../utils/sounds';

// ── BarcodeDetector Types ──
interface DetectedBarcode {
  boundingBox: DOMRectReadOnly;
  cornerPoints: { x: number; y: number }[];
  format: string;
  rawValue: string;
}

interface BarcodeDetector {
  detect(image: HTMLVideoElement | ImageBitmap): Promise<DetectedBarcode[]>;
}

declare global {
  var BarcodeDetector: {
    new (options: { formats: string[] }): BarcodeDetector;
    getSupportedFormats(): Promise<string[]>;
  } | undefined;
}

interface ScannedCard {
  name: string;
  set_name: string;
  card_number?: string;
  dbId?: number;
  rawCode?: string;
  isSharedInventory?: boolean;
  sharedCards?: any[];
}

interface CardOverlay {
  code: DetectedBarcode;
  card: ScannedCard;
  foundCard: Card | null;
  existingCount: number;
  existingTotal: number;
}

function parseScanData(data: string): ScannedCard {
  if (data.startsWith('{')) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'tcg_share' && parsed.cards) {
        return { name: 'SHARED_INVENTORY', set_name: '', isSharedInventory: true, sharedCards: parsed.cards };
      }
      return {
        name: parsed.name || parsed.card_name || 'Unknown Card',
        set_name: parsed.set_name || parsed.set || '',
        card_number: parsed.card_number || parsed.number,
        dbId: parsed.id ? Number(parsed.id) : undefined,
      };
    } catch { /* fall through */ }
  }
  if (data.includes('|')) {
    const parts = data.split('|');
    return {
      name: parts[0]?.trim() || 'Unknown Card',
      set_name: parts[1]?.trim() || '',
      card_number: parts[2]?.trim(),
    };
  }
  return { name: '', set_name: '', rawCode: data.trim() };
}

export default function ScannerWebPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<string | null>(null);

  // High performance cache tracking layers
  const cacheRef = useRef<Map<string, Omit<CardOverlay, 'code'>>>(new Map());
  const pendingLookups = useRef<Set<string>>(new Set());
  const soundedCodes = useRef<Set<string>>(new Set());

  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedCodes, setDetectedCodes] = useState<DetectedBarcode[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [selectedCard, setSelectedCard] = useState<ScannedCard | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [barcodeSupported, setBarcodeSupported] = useState<boolean | null>(null);
  const [existingCards, setExistingCards] = useState<Card[]>([]);
  const [foundCard, setFoundCard] = useState<Card | null>(null);
  const [cardOverlays, setCardOverlays] = useState<CardOverlay[]>([]);

  // Track exact screen rendering footprint to handle objectFit 'cover' scales
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [videoIntrinsicSize, setVideoIntrinsicSize] = useState({ width: 1, height: 1 });

  // 1. Detect Barcode API availability
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window && window.BarcodeDetector) {
      setBarcodeSupported(true);
      detectorRef.current = new window.BarcodeDetector({ formats: ['data_matrix'] });
    } else {
      setBarcodeSupported(false);
      setCameraError('BarcodeDetector API not supported. Use Chrome/Edge 83+.');
    }
  }, []);

  // 2. Track window/container dimension shifts
  useEffect(() => {
    if (Platform.OS !== 'web' || !containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [hasCamera]);

  // 3. Mount Stream
  useEffect(() => {
    if (barcodeSupported === false) return;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            setHasCamera(true);
            setVideoIntrinsicSize({
              width: videoRef.current!.videoWidth || 1280,
              height: videoRef.current!.videoHeight || 720,
            });
          };
        }
      } catch (err: any) {
        setCameraError(err.message || 'Could not access camera');
        setHasCamera(false);
      }
    }

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [barcodeSupported]);

  // 4. Unified Thread Loop (Avoids Interval Stacking & Multiple SetStates)
  useEffect(() => {
    if (!hasCamera || !detectorRef.current || !isScanning) return;

    let animationFrameId: number;
    let lastExecution = 0;

    async function tick(timestamp: number) {
      // Limit cycle tracking strictly to roughly ~5-6 FPS to mitigate thermal/battery drain
      if (timestamp - lastExecution < 180) {
        animationFrameId = requestAnimationFrame(tick);
        return;
      }
      lastExecution = timestamp;

      if (!videoRef.current || !detectorRef.current) return;

      try {
        const codes = await detectorRef.current.detect(videoRef.current);
        setDetectedCodes(codes);

        const currentActiveKeys = new Set(codes.map(c => c.rawValue));

        // Perform required operations over newly discovered frames
        for (const code of codes) {
          const key = code.rawValue;

          if (cacheRef.current.has(key) || pendingLookups.current.has(key)) {
            continue;
          }

          pendingLookups.current.add(key);

          // Database microtask execution decoupled from main UI cycles
          (async () => {
            const scanned = parseScanData(key);
            let found: Card | null = null;
            let existingCount = 0;
            let existingTotal = 0;

            try {
              if (scanned.rawCode) {
                found = await findCardByDataMatrix(scanned.rawCode);
              }
              if (!found && scanned.dbId) {
                found = await getCardById(scanned.dbId);
              }
              if (!found) {
                const matches = await findCardsByScanData(scanned.name, scanned.set_name, scanned.card_number);
                if (matches.length > 0) {
                  found = matches[0];
                  existingCount = matches.length;
                  existingTotal = matches.reduce((s, c) => s + c.price_paid * c.quantity, 0);
                }
              }

              if (found && !soundedCodes.current.has(key)) {
                soundedCodes.current.add(key);
                playItemFoundSound();
              }
            } catch (e) {
              // Fail-safe default container parameters
            }

            // Only cache item results if the card is actively being tracked in view
            if (currentActiveKeys.has(key)) {
              cacheRef.current.set(key, {
                card: scanned,
                foundCard: found,
                existingCount,
                existingTotal,
              });
            }
            pendingLookups.current.delete(key);
          })();
        }

        // Clean out metadata caches for long-lost cards
        for (const cachedKey of cacheRef.current.keys()) {
          if (!currentActiveKeys.has(cachedKey)) {
            cacheRef.current.delete(cachedKey);
          }
        }

        // Construct complete overlays array map dynamically per frame execution pass
        const continuousOverlays: CardOverlay[] = codes.map(code => {
          const cached = cacheRef.current.get(code.rawValue);
          return {
            code,
            card: cached?.card || parseScanData(code.rawValue),
            foundCard: cached?.foundCard || null,
            existingCount: cached?.existingCount || 0,
            existingTotal: cached?.existingTotal || 0,
          };
        });

        setCardOverlays(continuousOverlays);
      } catch (err) {
        // Safe operational boundary catch
      }

      animationFrameId = requestAnimationFrame(tick);
    }

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [hasCamera, isScanning]);

  // 5. Compute Matrix Coordinates using accurate layout boundaries (object-fit: cover offset correction)
  const getOverlayCoordinates = useCallback((box: DOMRectReadOnly) => {
    if (!containerSize.width || !containerSize.height) return { left: 0, top: 0, width: 0, height: 0 };

    const containerRatio = containerSize.width / containerSize.height;
    const videoRatio = videoIntrinsicSize.width / videoIntrinsicSize.height;

    let renderW = containerSize.width;
    let renderH = containerSize.height;
    let offsetX = 0;
    let offsetY = 0;

    if (containerRatio > videoRatio) {
      renderH = containerSize.width / videoRatio;
      offsetY = (containerSize.height - renderH) / 2;
    } else {
      renderW = containerSize.height * videoRatio;
      offsetX = (containerSize.width - renderW) / 2;
    }

    const scaleX = renderW / videoIntrinsicSize.width;
    const scaleY = renderH / videoIntrinsicSize.height;

    return {
      left: box.x * scaleX + offsetX,
      top: box.y * scaleY + offsetY,
      width: box.width * scaleX,
      height: box.height * scaleY,
    };
  }, [containerSize, videoIntrinsicSize]);

  const handleCodeTap = useCallback(async (overlay: CardOverlay) => {
    if (overlay.code.rawValue === lastScanRef.current) return;
    lastScanRef.current = overlay.code.rawValue;

    // Check if this is a shared inventory QR
    if (overlay.card.isSharedInventory && overlay.card.sharedCards) {
      setIsScanning(false);
      const cardList = overlay.card.sharedCards;
      const summary = cardList.slice(0, 10).map((c: any) => `• ${c.name} (${c.set_name})${c.price_target ? ` — $${c.price_target}` : ''}`).join('\n');
      const more = cardList.length > 10 ? `\n... and ${cardList.length - 10} more` : '';
      if (typeof window !== 'undefined') {
        alert(`📋 Shared Inventory — ${cardList.length} cards\n\n${summary}${more}`);
      }
      lastScanRef.current = null;
      setIsScanning(true);
      return;
    }

    setSelectedCard(overlay.card);

    // If raw DataMatrix code, try data_matrix lookup first
    if (overlay.card.rawCode) {
      try {
        const dmCard = await findCardByDataMatrix(overlay.card.rawCode);
        if (dmCard) {
          setFoundCard(dmCard);
          setExistingCards([]);
          setShowOverlay(true);
          setIsScanning(false);
          return;
        }
      } catch {}
    }

    setFoundCard(overlay.foundCard);
    setExistingCards([]);
    setShowOverlay(true);
    setIsScanning(false);
  }, []);

  const handleOverlayClose = () => {
    setShowOverlay(false);
    setSelectedCard(null);
    setExistingCards([]);
    setFoundCard(null);
    lastScanRef.current = null;
    setTimeout(() => setIsScanning(true), 300);
  };

  if (barcodeSupported === false || cameraError) {
    const isNoCam = !!cameraError;
    return (
      <View style={styles.container}>
        <View style={styles.centerMsg}>
          <Text style={styles.warnIcon}>{isNoCam ? '📷' : '⚠️'}</Text>
          <Text style={styles.warnTitle}>{isNoCam ? 'Camera Error' : 'Browser Not Supported'}</Text>
          <Text style={styles.warnText}>
            {isNoCam ? cameraError : (
              <>Use <Text style={{ color: Colors.accent, fontWeight: '700' }}>Chrome 83+</Text> or{' '}
              <Text style={{ color: Colors.accent, fontWeight: '700' }}>Edge 83+</Text> for live scanning.</>
            )}
          </Text>
          <TouchableOpacity style={styles.manualBtnLarge} onPress={() => router.push('/register')}>
            <Text style={styles.webRegisterBtnText}>＋ Register Card</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Hardware Header: Pokédex Lens & Lights */}
      <View style={DexStyles.header}>
        <View style={DexStyles.lensOuter}>
          <View style={DexStyles.lensInner} />
        </View>
        <View style={DexStyles.ledGroup}>
          <View style={[DexStyles.led, { backgroundColor: DexColors.ledRed }]} />
          <View style={[DexStyles.led, { backgroundColor: DexColors.ledAmber }]} />
          <View style={[DexStyles.led, { backgroundColor: DexColors.ledGreen }]} />
        </View>
      </View>

      {/* The Camera Viewport */}
      <div ref={containerRef} style={webStyles.videoContainer}>
        <video ref={videoRef} autoPlay playsInline muted style={webStyles.video} />

        {/* Futuristic targeting brackets corners */}
        <div style={webStyles.targetBracketTL} />
        <div style={webStyles.targetBracketTR} />
        <div style={webStyles.targetBracketBL} />
        <div style={webStyles.targetBracketBR} />

        {/* Floating Card Overlays (Rendered from your loop) */}
        {cardOverlays.map((overlay) => {
          const coords = getOverlayCoordinates(overlay.code.boundingBox);
          const { foundCard, card, existingCount, existingTotal } = overlay;
          const isFound = !!foundCard;

          return (
            <div
              key={overlay.code.rawValue}
              onClick={() => handleCodeTap(overlay)}
              style={{
                ...webStyles.overlayContainer,
                left: `${coords.left}px`,
                top: `${coords.top}px`,
                width: `${coords.width}px`,
                height: `${coords.height}px`,
              }}
            >
              {/* Holographic glowing scanner bounding box */}
              <div
                style={{
                  ...webStyles.boundingBox,
                  borderColor: isFound ? DexColors.holoCyan : DexColors.scanRed,
                  boxShadow: isFound
                    ? `0 0 15px ${DexColors.holoCyanGlow}, inset 0 0 8px rgba(0, 255, 255, 0.4)`
                    : `0 0 15px ${DexColors.scanRedGlow}, inset 0 0 8px rgba(255, 59, 48, 0.4)`,
                }}
              />

              {/* Pokédex Data UI Panel */}
              <div
                style={{
                  ...webStyles.infoPanel,
                  borderColor: isFound ? DexColors.holoCyan : DexColors.scanRed,
                }}
              >
                <div style={webStyles.dexNumber}>
                  {isFound ? `DATA_ID: #${foundCard!.id}` : 'SCANNING_'}
                </div>
                <div style={webStyles.infoName}>
                  {isFound ? foundCard!.name.toUpperCase() : card.name.toUpperCase()}
                </div>

                <div style={webStyles.divider} />

                {isFound ? (
                  <>
                    <div style={webStyles.infoMeta}>{foundCard!.set_name.toUpperCase()}</div>
                    <div style={webStyles.infoPriceRow}>
                      <span style={webStyles.infoPrice}>{formatCurrency(foundCard!.price_paid)}</span>
                    </div>
                    <div style={webStyles.tapHint}>▼ TAP FOR SYSTEM DATA</div>
                  </>
                ) : (
                  <>
                    <div style={webStyles.infoMeta}>UNKNOWN OBJECT</div>
                    <div style={{ ...webStyles.tapHint, color: DexColors.scanRed }}>▼ TAP TO REGISTER</div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Control Deck */}
      <View style={DexStyles.bottomDeck}>
        <View style={DexStyles.dPad}>
          <View style={DexStyles.dPadHorizontal} />
          <View style={DexStyles.dPadVertical} />
        </View>

        <TouchableOpacity style={DexStyles.actionBtn} onPress={() => router.push('/register')}>
          <Text style={styles.dexActionBtnText}>NEW REGISTRY</Text>
        </TouchableOpacity>

        <View style={DexStyles.ventGroup}>
          <View style={DexStyles.vent} />
          <View style={DexStyles.vent} />
          <View style={DexStyles.vent} />
        </View>
      </View>

      {/* Overlays */}
      <QuickAddOverlay
        visible={showOverlay}
        scannedData={selectedCard}
        foundCard={foundCard}
        existingCards={existingCards}
        onClose={handleOverlayClose}
        onSaved={handleOverlayClose}
      />
    </View>
  );
}

const webStyles: Record<string, React.CSSProperties> = {
  videoContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  overlayContainer: {
    position: 'absolute',
    zIndex: 10,
    cursor: 'pointer',
  },
  boundingBox: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0, left: 0,
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 6,
    pointerEvents: 'none',
  },
  targetBracketTL: { position: 'absolute', top: 20, left: 20, width: 30, height: 30, borderTop: '4px solid #00FFFF', borderLeft: '4px solid #00FFFF', pointerEvents: 'none', opacity: 0.6 },
  targetBracketTR: { position: 'absolute', top: 20, right: 20, width: 30, height: 30, borderTop: '4px solid #00FFFF', borderRight: '4px solid #00FFFF', pointerEvents: 'none', opacity: 0.6 },
  targetBracketBL: { position: 'absolute', bottom: 20, left: 20, width: 30, height: 30, borderBottom: '4px solid #00FFFF', borderLeft: '4px solid #00FFFF', pointerEvents: 'none', opacity: 0.6 },
  targetBracketBR: { position: 'absolute', bottom: 20, right: 20, width: 30, height: 30, borderBottom: '4px solid #00FFFF', borderRight: '4px solid #00FFFF', pointerEvents: 'none', opacity: 0.6 },
  divider: { height: '1px', backgroundColor: 'rgba(0, 255, 255, 0.3)', margin: '6px 0' },
  infoPanel: {
    position: 'absolute',
    top: 'calc(100% + 12px)',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: 'rgba(6, 15, 15, 0.94)',
    border: '2px solid',
    borderRadius: 4,
    padding: '12px',
    minWidth: 200,
    textAlign: 'left',
    fontFamily: 'monospace',
    boxShadow: '0px 10px 30px rgba(0,0,0,0.7)',
  },
  dexNumber: {
    color: '#8A9A9A',
    fontSize: 10,
    letterSpacing: 1,
    fontWeight: 'bold',
  },
  infoName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  infoMeta: { color: '#7A8494', fontSize: 10, marginTop: 2 },
  infoPriceRow: { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginTop: 4 },
  infoPrice: {
    color: '#00FFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  tapHint: { color: '#4A5464', fontSize: 9, fontStyle: 'italic', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.3 },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DexColors.frameDark,
  },
  dexActionBtnText: {
    color: DexColors.btnText,
    fontWeight: '900' as const,
    fontSize: FontSize.md,
    letterSpacing: 0.5,
  },
  centerMsg: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  warnIcon: { fontSize: 48, marginBottom: Spacing.md },
  warnTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'center' },
  warnText: { color: Colors.textSecondary, fontSize: FontSize.md, textAlign: 'center', lineHeight: 22 },
  manualBtnLarge: { marginTop: Spacing.lg, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 6, backgroundColor: Colors.accent },
  webRegisterBtnText: { color: Colors.bg, fontSize: FontSize.md, fontWeight: '700' },
  loadingOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)' },
  scanHintContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 100 : 60, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6, zIndex: 20 },
  scanHint: { color: Colors.textSecondary, fontSize: FontSize.sm, textAlign: 'center' },
});
