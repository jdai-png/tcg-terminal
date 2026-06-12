---
title: "Enhanced Features v2 — Implementation Plan"
type: plan
date: 2026-06-12
workbranch: enhanced-features-v2
specs:
  - .unipi/docs/specs/2026-06-12-enhanced-features-v2-design.md
---

# Enhanced Features v2 — Implementation Plan

## Overview
Implement 5 feature groups (A–E) across database layer, UI screens, and utilities. Work on branch `enhanced-features-v2`.

## Tasks

- completed: Task 1 — Database Schema Migrations
  - Description: Add `description`, `archived`, `archived_at` columns to cards table. Add time-filtered P&L query functions. Add settings table support for social handles. Both web (index.ts) and native (index.native.ts).
  - Dependencies: None
  - Acceptance Criteria:
    - `description TEXT`, `archived INTEGER DEFAULT 0`, `archived_at TEXT` on cards
    - `getPnLSummary(from?, to?)`, `getPnLBySet(from?, to?)`, `getPnLByCard(from?, to?)`, `getSalesHistory(from?, to?, limit?, offset?)` accept optional date range params
    - `getAppSettings()` and `setAppSetting(key, value)` functions
    - Migration code handles both web (localStorage) and native (ALTER TABLE)
    - Existing cards get default values, no data loss
  - Steps:
    1. Add `description`, `archived`, `archived_at` to Card/CardInsert interfaces in both DB files
    2. Add migration logic (ALTER TABLE for native, default values for web)
    3. Add time-range params to P&L functions
    4. Add `getAppSettings()` / `setAppSetting()` functions
    5. Update seed data to include new fields
    6. Run `tsc --noEmit` to verify

- completed: Task 2 — Settings Screen & Social Handles
  - Description: Create `app/settings.tsx` with social handle fields, label preferences. Add navigation link from logistics.
  - Dependencies: Task 1 (settings DB functions)
  - Acceptance Criteria:
    - Settings screen with: Instagram, Twitter/X, eBay Store, Website, Custom 1, Custom 2 fields
    - "Include social handles on label" toggle
    - Settings persist across app restarts
    - Accessible from logistics screen and bottom tab (optional)
  - Steps:
    1. Create `app/settings.tsx` with form fields and save functionality
    2. Add settings link to logistics.tsx header
    3. Add settings to _layout.tsx tab navigation (gear icon)

- completed: Task 3 — Card Metadata: Description + Calendar + Days in Inventory + Image
  - Description: Add description field, date picker component, days-in-inventory display, image upload/view on card detail, register, and edit screens.
  - Dependencies: Task 1 (schema)
  - Acceptance Criteria:
    - Description field editable on Register, Edit, and displayed on Detail
    - Calendar picker replaces text input for purchase_date (all screens)
    - "Days in Inventory" badge on card detail (green/amber/red)
    - Image upload via camera/gallery, thumbnail on detail, tappable full-screen preview
  - Steps:
    1. Create reusable `DatePickerField` component
    2. Update `app/register.tsx` — add description, calendar picker, image upload
    3. Update `app/inventory/[id].tsx` — days-in-inventory badge, description display, image preview
    4. Update edit form — add description, calendar picker, image field
    5. Install `expo-image-picker` if needed
    6. Update CSV export/import for description and archived fields

- in-progress: Task 4 — Sales Archiving & ID Retirement
  - Description: Decrement card quantity on sale. Auto-archive when quantity hits 0. Add archive toggle to inventory filter. Un-archive support. Prevent sales of archived cards.
  - Dependencies: Task 1 (archived columns)
  - Acceptance Criteria:
    - Recording a sale decrements card quantity by sale quantity
    - Quantity 0 → auto-archives card, sets archived_at
    - Archived cards hidden from inventory, scanner, sale picker by default
    - "Include Archived" toggle on inventory filter bar
    - Archived cards shown with "Archived" badge, read-only
    - Un-archive button restores quantity to 1, clears archived flags
    - Cannot record sale of archived card — user prompted to un-archive first
    - Deleting a sale warns about quantity inconsistency
  - Steps:
    1. Update `recordSale` in DB to decrement card quantity and archive if 0
    2. Update `getAllCards` to support `includeArchived` filter
    3. Add "Include Archived" toggle to FilterBar component
    4. Update inventory list to show archived badge and disable editing
    5. Add un-archive logic (updateCard to set archived=0, archived_at=null, quantity=1)
    6. Update sale record modal — filter out archived cards, warn on archive
    7. Add delete-sale warning alert

- unstarted: Task 5 — Time-Filtered P&L Analytics
  - Description: Add filter chip bar to Sales screen (Lifetime, Annual, YTD, Monthly, Weekly, Daily, Custom). Update P&L summary cards, top cards, and sales history for selected period.
  - Dependencies: Task 1 (time-filtered DB functions)
  - Acceptance Criteria:
    - Horizontal filter chip bar above P&L section
    - 7 filter options: Lifetime, Annual, YTD, Monthly, Weekly, Daily, Custom
    - P&L summary cards update per filter
    - Top performing cards re-rank per filter
    - Sales history filters to selected period
    - Custom option opens two calendar pickers for start/end
    - Active filter highlighted with accent color
  - Steps:
    1. Create `PnLFilterBar` component with chip selection and Custom date range support
    2. Update Sales screen to pass date range to DB queries
    3. Update Dashboard to pass date range to P&L summary (optional)
    4. Wire date ranges: compute from/to based on selected filter
    5. Add filter label to section headers (e.g., "P&L · This Month")

- unstarted: Task 6 — Enhanced DataMatrix Labels
  - Description: Encode price_target in DataMatrix. Add social handle preferences from settings. Update print label layout to show price target and socials.
  - Dependencies: Task 2 (settings screen)
  - Acceptance Criteria:
    - DataMatrix JSON includes `price_target` field
    - Optional `ig`, `x`, `web` fields from settings
    - Label print layout shows price target prominently
    - PrintLabelModal preview updates to reflect new layout
    - "Include social handles" toggle in modal before printing
  - Steps:
    1. Update `encodeCardForLabel` to include price_target
    2. Update `PrintLabelModal` to read settings and conditionally include social handles
    3. Update `printLabel` HTML template — add price target display, social handle line
    4. Update label preview in modal

- unstarted: Task 7 — QR Inventory Sharing
  - Description: Add "Share Inventory" button to logistics screen. Generate QR code with sanitized inventory JSON. Scanner recognizes share payload and displays read-only view.
  - Dependencies: None
  - Acceptance Criteria:
    - "Share Inventory" button on logistics screen
    - QR code generated with sanitized card list (no cost data)
    - QR displays full-screen for others to scan
    - Scanner detects `tcg_share` payload type
    - Read-only inventory modal shown with card names, sets, conditions, price targets
  - Steps:
    1. Add QR generation using bwip-js (QR code mode) in a util function
    2. Create `ShareInventoryModal` component — sanitizes data, generates QR, displays full-screen
    3. Add "Share Inventory" button to logistics.tsx
    4. Update scanner (both native and web) to detect `type: "tcg_share"` payload
    5. Create `SharedInventoryView` modal — read-only display of shared cards

## Sequencing
Task 1 → Task 2 + Task 3 + Task 4 (parallel after schema)
Task 2 → Task 6 (depends on settings)
Task 1 → Task 5 (depends on DB functions)
Task 7 is independent, can run anytime

## Risks
- Image handling on native vs web differs significantly (FileSystem API)
- Date picker has different native/web implementations
- DataMatrix QR + inventory QR could conflict in scanner (need payload type discrimination)
- Quantity tracking edge cases (partial sales, quantity > stock)
- CSV export/import must include new fields backward-compatibly
