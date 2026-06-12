---
title: "Enhanced Features v2"
type: brainstorm
date: 2026-06-12
---

# Enhanced Features v2

## Problem Statement
Power users need richer card metadata, automated sales archiving, time-filtered P&L analytics, enhanced DataMatrix labels with social handles, and QR-based inventory sharing to level up from basic tracking to a full collector/investor platform.

## Context
- Existing app has 5 screens + scanner with full CRUD, CSV import/export, P&L (all-time), sales, EOD reports
- Schema already has `price_target`, `price_sold`, `data_matrix`, `tags`, `image_uri`, `notes`
- DataMatrix labels currently encode only `{name, set_name, card_number, id}`
- P&L is all-time only — no date range filtering
- No archiving — sold cards remain active
- No calendar picker — all dates entered as text

## Chosen Approach
Incremental enhancement — build on existing schema and patterns. Add columns where needed, extend existing screens, add one new settings screen. No breaking changes to existing data.

## Why This Approach
- Uses existing dual-database pattern (web + native)
- Minimal new dependencies (expo-image-picker, datetimepicker)
- Backward compatible — existing cards survive migration
- Feature F (market pricing) deferred to keep scope manageable

## Design
- **A — Card Metadata:** Add `description` column, calendar picker for dates, days-in-inventory display, image upload/view
- **B — Sales Archiving:** Add `archived` + `archived_at` columns. Decrement quantity on sale. Auto-archive at 0. Archive filter toggle.
- **C — Time-Filtered P&L:** Add optional `from`/`to` params to P&L queries. Filter chip bar on Sales screen.
- **D — Enhanced Labels:** Encode `price_target` in DataMatrix. Add social handle settings. Update print layout.
- **E — QR Sharing:** Generate QR with sanitized inventory JSON. Scan to view read-only.

## Implementation Checklist
- [ ] A1-A4: Card metadata (description, calendar, days-in-inventory, image)
- [ ] B1-B2: Sales archiving & ID retirement
- [ ] C1-C4: Time-filtered P&L analytics
- [ ] D1-D5: Enhanced DataMatrix labels + social handles
- [ ] E1-E3: QR-based inventory sharing

## Out of Scope
- Market Pricing API (Feature F)
- Multi-currency support
- Cloud sync
- Price alerts
