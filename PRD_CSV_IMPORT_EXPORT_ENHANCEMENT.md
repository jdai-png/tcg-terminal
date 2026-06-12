# PRD: CSV Import/Export Enhancement — TCG Terminal Logistics

**Version:** 1.0  
**Date:** 2026-06-09  
**Status:** In Progress

---

## Overview

The current CSV import/export on the Logistics page operates in a simple **append-only** or **full-replace** mode. Users cannot update existing inventory via CSV, have no visibility into internal DB IDs or DataMatrix codes, and receive minimal feedback after operations. This enhancement transforms the CSV pipeline into a full **batch inventory management** tool that supports upserts (update + insert), user-assignable IDs, DataMatrix tracking, and richer feedback.

---

## Goals

1. **Import as Update (Upsert)**  
   CSV import should match rows to existing cards by `id` or `data_matrix` and **update** them instead of always inserting duplicates.

2. **Assignable Card IDs**  
   Users can assign their own numeric IDs to each card. The system uses these IDs for matching on import. Auto-generated IDs continue for cards without a user-assigned ID.

3. **DataMatrix Visibility**  
   Export includes the `data_matrix` field. Users can see which DataMatrix codes are registered per card and assign new ones via CSV import.

4. **Batch Update**  
   Users can export the full library, modify pricing/condition/notes/targets in a spreadsheet, and re-import to batch-update the entire inventory.

5. **Rich User Feedback**  
   After import/export: a non-intrusive in-app banner showing:
   - ✅ Success / ❌ Error status
   - Cards added count
   - Cards updated count
   - Cards skipped / failed count
   - File name

6. **Price Target & Price Sold**  
   Two new fields per card:
   - `price_target` — desired selling price
   - `price_sold` — actual price the card was sold at  
   These feed into P&L reporting for margin/profitability analysis.

---

## Non-Goals

- Real-time CSV editing (users edit in their spreadsheet app of choice)
- Automatic DataMatrix assignment (users assign manually or via scanner)
- Multi-currency support
- CSV versioning / rollback

---

## User Stories

| # | As a... | I want to... | So that... |
|---|---------|-------------|------------|
| 1 | Inventory manager | Export my entire inventory with all IDs and DataMatrix codes | I can review and edit in a spreadsheet |
| 2 | Inventory manager | Import a CSV to batch-update pricing across 100+ cards | I don't have to edit each card individually |
| 3 | Collector | Assign my own custom IDs to cards | I can match my physical inventory numbering system |
| 4 | Seller | Set a price target on each card | I know at a glance what I want to sell for |
| 5 | Seller | Record the actual sold price per card | My P&L reports track realized vs target margins |
| 6 | Any user | See clear feedback after every import/export | I trust the operation completed correctly |
| 7 | Power user | Re-import the same CSV multiple times | Only changed fields get updated, existing cards don't duplicate |

---

## Technical Design

### 1. Schema Changes

#### Cards table — new columns

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `data_matrix` | TEXT/NULL | NULL | DataMatrix barcode value from physical card |
| `price_target` | REAL | 0 | Desired selling price (per unit) |
| `price_sold` | REAL | 0 | Actual realized sale price (per unit) |
| `tags` | TEXT/NULL | NULL | Comma-separated tags (future use) |

#### Migration strategy

- **Web (localStorage):** New fields default to `null` / `0` for existing cards; no migration needed.
- **Native (SQLite):** `ALTER TABLE cards ADD COLUMN` statements wrapped in try/catch (columns may already exist).

### 2. CSV Format Changes

#### New columns (added to existing 9)

| Column | Required | Description |
|--------|----------|-------------|
| `id` | No | User-assigned or system ID. If present and > 0, updates matching card. |
| `data_matrix` | No | DataMatrix barcode string |
| `price_target` | No | Desired sell price (e.g. `500.00`) |
| `price_sold` | No | Actual sold price (e.g. `480.00`) |
| `tags` | No | Comma-separated tags |

#### Full CSV header (13 columns total)

```
name,set_name,card_number,rarity,condition,price_paid,quantity,purchase_date,notes,id,data_matrix,price_target,price_sold,tags
```

### 3. Import Logic (Upsert)

```
For each CSV row:
  1. If 'id' is present and > 0:
     → UPDATE the card with that id (all non-empty fields)
  2. Else if 'data_matrix' is present and matches an existing card:
     → UPDATE that card
  3. Else:
     → INSERT as new card

  Track: added, updated, skipped, failed counts
```

### 4. Feedback UI

Replace `Alert.alert()` with an in-page **result banner** that:
- Appears at top of logistics screen after import/export completes
- Color-coded: green (success), amber (partial), red (failure)
- Shows counts: added, updated, skipped, failed
- Auto-dismisses after 8 seconds or on tap
- Also logs to Operation History (existing behavior)

### 5. P&L Integration

- `price_target` vs `price_sold` comparison shown on card detail page
- `price_target` available in export for spreadsheet analysis
- `sale_price` on the Sales table remains the authoritative source for P&L (price_sold on Card is informational/derived)

---

## Files Changed

| File | Change |
|------|--------|
| `database/index.ts` | Add fields to Card/CardInsert; upsertCard function; seed update |
| `database/index.native.ts` | Schema migration + same types/apis |
| `utils/csv.ts` | Extended CSV_HEADERS; upsert-aware import; richer ImportResult |
| `app/logistics.tsx` | Result banner component; updated format reference; new columns in preview |
| `app/inventory/[id].tsx` | Display price_target / price_sold on card detail |
| `components/` | New `ResultBanner` component |

---

## Acceptance Criteria

- [ ] Export CSV contains `id`, `data_matrix`, `price_target`, `price_sold`, `tags`
- [ ] Import with `id` column updates existing cards instead of inserting
- [ ] Import without `id` but matching `data_matrix` updates the card
- [ ] Import without `id` or `data_matrix` match inserts new cards
- [ ] Empty fields in imported CSV do NOT overwrite existing values
- [ ] Result banner shows after import/export with counts
- [ ] `price_target` and `price_sold` displayed on card detail screen
- [ ] All seed data / existing cards survive migration
- [ ] Operation history logs correctly for all operations
- [ ] Works on both web and native

---

## Out of Scope (Future)

- CSV diff preview (show what changed)
- Undo last import
- Export filters (only export certain sets/conditions)
- Scheduled auto-exports to cloud
