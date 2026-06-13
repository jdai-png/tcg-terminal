# PRD: Scanner Battery & Performance Optimization

**Status:** In Progress  
**Date:** 2026-06-09  
**Target:** TCG Terminal v1.x

---

## Problem Statement

The scanner currently drains battery excessively due to:

1. **Over-scanning**: The barcode detector scans for 6 formats (qr, datamatrix, pdf417, aztec, code128, code39) when only DataMatrix is relevant.
2. **Uncapped frame rate**: The web scanner's `requestAnimationFrame` loop runs detection at display refresh rate (~60fps), burning CPU on every frame.
3. **Sound looping**: The "item found" sound replays continuously while a DataMatrix is held in frame, creating an annoying loop and wasting audio resources.

---

## Goals

| Metric | Current | Target |
|--------|---------|--------|
| Barcode formats scanned | 6 | **1** (DataMatrix only) |
| Web detection FPS | ~60fps (uncapped) | **~5fps** (200ms interval) |
| Sound trigger | Multi-fire per scan | **Once** per unique code per session |
| CPU usage (web, idle camera) | Baseline | ≤ baseline + 15% |

---

## Requirements

### R1 — Single Format Scanning

**Native (expo-camera):**
- Change `barcodeScannerSettings.barcodeTypes` from `['qr', 'datamatrix', 'pdf417', 'aztec', 'code128', 'code39']` to `['datamatrix']`.
- The OS-level barcode engine will skip 5 unused decoders, reducing CPU per frame.

**Web (BarcodeDetector API):**
- Change `BarcodeDetector` format list from `['qr_code', 'data_matrix', 'pdf417', 'aztec', 'code_128', 'code_39']` to `['data_matrix']`.
- Fewer detection algorithms run per frame.

### R2 — Throttled Detection Loop (Web Only)

- Replace `requestAnimationFrame` continuous loop with a **timer-based** loop using `setInterval` at 200ms (5fps).
- Detection runs on a fixed cadence regardless of display frame rate.
- Between intervals, the CPU idles.

Alternative considered: `requestAnimationFrame` with a frame counter skip. Rejected because it still wakes the CPU every vsync (16ms).

**Expected savings:** ~90% reduction in detection CPU time (from 60 detections/sec → 5 detections/sec).

### R3 — Single-fire Sound

- Track sounded codes in a `Set<string>` that persists for the entire scanner session.
- Once a code's sound fires, it **never fires again** until the scanner is unmounted or the user navigates away.
- Remove the "cleanup on code exit" logic that resets the sound state when a code leaves the frame.

### R4 — Cleanup on Unmount

- On component unmount (screen exit), stop the detection interval, release camera stream, clear all timers.
- Prevent background scanning when the scanner tab is not active.

---

## Implementation Plan

### File: `app/scanner.tsx` (Native)
- [x] Limit `barcodeTypes` to `['datamatrix']`

### File: `app/scanner.web.tsx` (Web)
- [x] Limit `BarcodeDetector` formats to `['data_matrix']`
- [x] Replace `requestAnimationFrame` loop with `setInterval` at 200ms
- [x] Make `soundedCodes` persist for the full session (remove exit-based cleanup)
- [x] Clear interval + stream on unmount

---

## Testing Notes

- Verify DataMatrix codes scan correctly after format restriction
- Hold a DataMatrix in frame for 10+ seconds — sound should fire exactly once
- Monitor browser DevTools Performance tab for CPU usage improvement
- Test tab switching: camera should release when navigating away

---

## Future Considerations

- **Native FPS control**: expo-camera doesn't expose a detection throttle. If needed, we could debounce `onBarcodeScanned` with a 200ms cooldown (already partially implemented via `isScanning` state).
- **Camera resolution**: Lowering capture resolution could further reduce battery, but may impact scan accuracy at distance.
- **Background detection**: Use `AppState` to pause camera when app is backgrounded (already implemented).
