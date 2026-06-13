# PRD: Enhanced Features v2 — TCG Terminal

**Version:** 1.0  
**Date:** 2026-06-12  
**Status:** Planning  
**Source:** Friend feature requests for collector/investor workflow

---

## Overview

This PRD covers a set of enhancements requested by power users to transform TCG Terminal from a basic inventory tracker into a full-featured collector/investor platform. Features fall into 6 categories:

| # | Category | Effort | Impact |
|---|----------|--------|--------|
| A | Enhanced Card Metadata | Medium | High |
| B | Sales Archiving & ID Retirement | Medium | High |
| C | Time-Filtered P&L Analytics | High | High |
| D | Enhanced DataMatrix Labels | Small | Medium |
| E | QR-Based Inventory Sharing | Medium | Medium |
| F | Market Pricing API (Optional) | High | Medium |

---

## A — Enhanced Card Metadata

### A1. Description Field

**Current:** `notes` field exists as free text, used generically.  
**Request:** Dedicated `description` field for card flavor text, grading notes, or distinguishing details.

**Implementation:**
- Add `description TEXT` column to cards table
- Show in card detail view and edit form
- Include in CSV export/import

### A2. Calendar Date Picker

**Current:** Date fields (`purchase_date`, `sale_date`) use plain `<TextInput>` with manual `YYYY-MM-DD` entry.  
**Request:** Native calendar/date picker for all date fields.

**Implementation:**
- Use `@react-native-community/datetimepicker` (or Expo's date picker)
- Replace all text-based date inputs with a tappable date display that opens a calendar
- Apply to: `purchase_date` (register & edit), `sale_date` (record sale), EOD report date selection
- Fallback to text input on web if native picker unavailable

### A3. Days in Inventory

**Current:** Card detail shows `created_at` and `updated_at` timestamps but no duration calculation.  
**Request:** Show how many days a card has been held in inventory.

**Implementation:**
- Compute `daysInInventory = (today - created_at)` in days
- Display on card detail screen and inventory list as a sortable metric
- Include in CSV export as computed column (optional)
- Color-code: green (< 30 days), amber (30–90 days), red (> 90 days) for stale inventory

### A4. Card Image Display

**Current:** `image_uri` field exists in the schema but is never surfaced in the UI.  
**Request:** Show card images on the detail screen and optionally in list views.

**Implementation:**
- Add image upload capability to Register and Edit screens (camera or gallery via `expo-image-picker`)
- Display `image_uri` as a thumbnail on card detail, tappable for full-screen preview
- Store images locally (FileSystem) with reference URI in DB
- Show thumbnail in inventory list (optional toggle)
- Include image URI in CSV export (path reference)

---

## B — Sales Archiving & ID Retirement

### B1. Auto-Archive on Sale

**Current:** When a card is sold, the `Sale` record is created but the `Card` record remains active with unchanged quantity. Users must manually reduce quantity.  
**Request:** When all quantity of a card is sold, auto-archive the card and retire its unique ID.

**Implementation:**

1. **Schema additions to `cards` table:**
   - `archived` INTEGER DEFAULT 0 (boolean — 1 = archived)
   - `archived_at` TEXT (timestamp of archival)

2. **Sales flow changes:**
   - When recording a sale, decrement the card's `quantity` by the sale quantity
   - If `quantity` reaches 0, set `archived = 1`, `archived_at = now()`
   - Archived cards are hidden from:
     - Inventory list (by default)
     - Scanner lookup results
     - Quick Add overlay
     - "Record Sale" card picker
   - Archived cards ARE included in:
     - P&L reports (cost basis is historical)
     - CSV export (marked with `archived` column)
     - Search with an "Include Archived" toggle/filter

3. **ID Retirement:**
   - A card's ID is never physically deleted (referential integrity for sales)
   - When `archived = 1`, the ID is considered "retired"
   - Archived IDs can be searched via "Include Archived" but cannot be edited

4. **Un-archive:**
   - User can manually un-archive a card (e.g., found another copy)
   - This restores quantity to 1, clears `archived_at`, sets `archived = 0`

5. **Edge cases:**
   - Partial sale (e.g., sell 2 of 4 copies): decrement quantity, card stays active
   - Sale of archived card: blocked — user must un-archive first
   - Deleting a Sale record: should NOT auto-restore quantity (too complex — handle manually)

### B2. Sales Flow UX Improvements

- After recording a sale, show confirmation with quantity remaining
- If quantity hits 0, show "Card archived — ID #{id} retired" message
- Add "View Archived" toggle to inventory filter bar

---

## C — Time-Filtered P&L Analytics

**Current:** P&L is all-time only (single `getPnLSummary()`). The Sales screen shows total revenue, cost basis, gross profit, ROI, and top-performing cards — but no date filtering.  
**Request:** P&L with filters: Lifetime, Annual, YTD, Monthly, Weekly, Daily.

### Implementation

#### C1. Database Layer

Add parameterized P&L functions with date range:

```typescript
getPnLSummary(from?: string, to?: string): Promise<PnLSummary>
getPnLBySet(from?: string, to?: string): Promise<{ set_name, revenue, cost, profit, count }[]>
getPnLByCard(from?: string, to?: string): Promise<{ card_name, set_name, revenue, cost, profit, count }[]>
getSalesHistory(from?: string, to?: string, limit?, offset?): Promise<Sale[]>
```

All functions default to all-time when no dates provided (backward compatible).

#### C2. UI — P&L Filter Bar

Add a horizontal filter chip bar above the P&L section on the Sales screen:

```
[Lifetime] [Annual] [YTD] [Monthly] [Weekly] [Daily] [Custom ▾]
```

| Filter | Date Range |
|--------|-----------|
| Lifetime | No filter (all data) |
| Annual | Current calendar year (Jan 1 – Dec 31) |
| YTD | Jan 1 – today |
| Monthly | Current calendar month |
| Weekly | Last 7 days (rolling) |
| Daily | Today only |
| Custom | User picks start/end dates via calendar |

#### C3. UI — Filtered Dashboard

When a filter is active:
- P&L summary cards update to reflect the date range
- "Top Performing Cards" re-ranks for the filtered period
- Sales history list filters to the period
- Active filter is highlighted with accent color
- Filter name shown in section header (e.g., "P&L · This Month")

#### C4. Chart Enhancement (Optional Future)

- Add a mini sparkline/bar chart showing P&L trend across selected period
- Show revenue vs cost over time

---

## D — Enhanced DataMatrix Labels

**Current:** DataMatrix encodes `{name, set_name, card_number, id}`. Label print layout shows name, set, card number, rarity, condition, price paid, and ID.  
**Request:** Also encode `price_target` and optional social handles (Instagram, Twitter, etc.) for marketplace listings.

### Implementation

#### D1. Encode Price Target

Add `price_target` to the DataMatrix JSON payload:

```json
{
  "name": "Charizard",
  "set_name": "Base Set",
  "card_number": "4/102",
  "id": 1,
  "price_target": 500.00
}
```

The scanner already handles unknown fields gracefully (JSON parse + fallback), so this is backward compatible.

#### D2. Social Handles Configuration

Add a **settings screen** (or section) where users can configure:

| Field | Default | Description |
|-------|---------|-------------|
| Instagram Handle | (empty) | @username |
| Twitter/X Handle | (empty) | @username |
| eBay Store | (empty) | Store name or URL |
| Website | (empty) | URL |
| Custom Field 1 | (empty) | User-defined |
| Custom Field 2 | (empty) | User-defined |

Settings stored in:
- **Web:** localStorage key `tcg_terminal_settings`
- **Native:** `settings` table (already exists in schema)

#### D3. Settings in DataMatrix

Optionally encode social handles in the DataMatrix (configurable per print — checkbox "Include social handles"):

```json
{
  "name": "Charizard",
  "set_name": "Base Set",
  "card_number": "4/102",
  "id": 1,
  "price_target": 500.00,
  "ig": "@pokemart",
  "x": "@pokemart",
  "web": "pokemart.com"
}
```

#### D4. Label Print Layout Updates

The physical label print layout now shows:
- **Top:** Card name, set, number, rarity
- **Center:** DataMatrix barcode (larger, includes price_target + optional socials)
- **Bottom-left:** Condition badge
- **Bottom-center:** Price Target (prominently) — `$$500.00`
- **Bottom-right:** "ID: #1 · @pokemart" (with Instagram handle if configured)

#### D5. Settings Screen

New screen at `app/settings.tsx`:
- Social handle fields
- Label print preferences (include socials toggle)
- Default export format preferences
- Clear cache / reset options (existing functionality moved here)

---

## E — QR-Based Inventory Sharing

**Current:** Export is CSV-only. No way to share a live or static inventory view.  
**Request:** Generate a QR code that links to a shareable inventory list.

### Implementation

#### E1. Inventory Snapshot Mode

Add a "Share Inventory" button on the Logistics screen that:
1. Generates a sanitized inventory snapshot (name, set, rarity, condition, price_target — NOT price_paid, notes, or cost data)
2. Encodes it as a compressed JSON payload in a QR code
3. Displays the QR code full-screen for others to scan

#### E2. QR Scanner Integration

When the TCG Terminal scanner scans a "Share Inventory" QR:
- Detects the special payload format (e.g., `{"type": "tcg_share", "version": 1, ...}`)
- Displays a read-only inventory view modal
- Shows: card names, sets, rarities, conditions, price targets
- Option to save the shared list as a reference (not imported into user's inventory)

#### E3. Web Share Link (Alternative)

- Generate a shareable link (e.g., base64-encoded JSON in URL fragment) that opens a read-only web view
- Useful for sharing via messaging apps when QR isn't practical

---

## F — Market Pricing API (Optional / Future)

**Current:** No external pricing data. Users manually enter `price_paid` and `price_target`.  
**Request:** Integration with a TCG pricing API (e.g., TCGPlayer, PriceCharting, Cardmarket).

### Implementation (High-Level)

#### F1. Price Lookup

- User taps "Look Up Price" on card detail or register screen
- App queries external API by card name + set + card number
- Returns: market price, low/mid/high, last sold, trend direction
- Displayed as a reference card — user still sets their own `price_target`

#### F2. Candidate APIs

| API | Coverage | Cost |
|-----|----------|------|
| TCGPlayer | Pokémon, Magic, Yu-Gi-Oh | Paid (affiliate) |
| PriceCharting | Pokémon, graded cards | Free tier available |
| PokéAPI | Card data (no pricing) | Free |

#### F3. Batch Price Refresh

- "Refresh All Prices" button on Logistics screen
- Rate-limited (1 request/sec) to respect API limits
- Shows progress bar
- Updates `price_target` suggestions (never overwrites user-set targets)

#### F4. Considerations

- API keys stored in settings
- Clear disclaimer: "Prices are estimates, not financial advice"
- Offline fallback: app works fully without API
- This feature is **optional** — tagged as "Phase 2" if scope needs reduction

---

## Files Changed

| File | Change |
|------|--------|
| `database/index.ts` | Add `description`, `archived`, `archived_at` columns; time-filtered P&L queries; migration logic |
| `database/index.native.ts` | Same schema changes + migrations + time-filtered queries |
| `utils/labelPrinter.ts` | Encode price_target in DataMatrix; support social handles |
| `utils/csv.ts` | Add description, archived fields to export/import |
| `app/inventory/[id].tsx` | Days in inventory display; image preview; description field; archive/unarchive button |
| `app/inventory/index.tsx` | Days in inventory column; archived filter toggle; image thumbnails |
| `app/sales/index.tsx` | Time-filtered P&L bar; auto-archive on sale; quantity decrement |
| `app/logistics.tsx` | QR inventory sharing generation; settings/preferences link |
| `app/register.tsx` | Calendar date picker; image upload; description field |
| `app/settings.tsx` | **NEW** — Social handles config, label preferences, API keys |
| `components/PrintLabelModal.tsx` | Show price_target on label; social handle toggle; updated preview |
| `components/FilterBar.tsx` | Add "Include Archived" toggle |
| `package.json` | Add `expo-image-picker`, `@react-native-community/datetimepicker` (or expo date picker) |

---

## Acceptance Criteria

### A — Card Metadata
- [ ] Description field available on Register, Edit, and Detail screens
- [ ] Calendar picker replaces text input for all date fields (native + web fallback)
- [ ] Days in inventory displayed on card detail and inventory list
- [ ] Card images uploadable (camera/gallery) and viewable in detail and list

### B — Sales & Archiving
- [ ] Recording a sale decrements card quantity
- [ ] Quantity reaching 0 auto-archives the card and retires its ID
- [ ] Archived cards hidden from inventory, scanner, and sale picker by default
- [ ] "Include Archived" toggle shows retired cards (read-only)
- [ ] Un-archive restores card to active with quantity = 1
- [ ] Deleting a sale warns user about quantity inconsistency

### C — Time-Filtered P&L
- [ ] Filter bar with Lifetime, Annual, YTD, Monthly, Weekly, Daily, Custom
- [ ] P&L summary cards update per active filter
- [ ] Top performing cards re-rank per filter
- [ ] Sales history filters to selected period
- [ ] Custom date range picker works with two calendar inputs
- [ ] Existing (all-time, no-filter) behavior unchanged

### D — DataMatrix Labels
- [ ] DataMatrix encodes `price_target` by default
- [ ] Social handles configurably included in DataMatrix
- [ ] Label print layout shows price target prominently
- [ ] Settings screen for social handles and label preferences

### E — QR Inventory Sharing
- [ ] "Share Inventory" generates a QR code with sanitized card list
- [ ] QR scannable by other TCG Terminal instances for read-only view
- [ ] Shareable web link alternative available

### F — Market Pricing (Optional)
- [ ] Price lookup from external API on card detail
- [ ] Batch price refresh with progress indicator
- [ ] Clear API key configuration in settings
- [ ] App functions fully offline without API

---

## Out of Scope (Future)

- Multi-currency support for market pricing
- Automated price alerts / notifications
- Portfolio value tracking over time with charts
- Barcode-based trade/purchase between two TCG Terminal users
- Cloud sync / multi-device support
- Graded card population report integration (PSA/BGS/CGC)
