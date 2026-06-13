# PRD: Database Layer Refactor — Eliminate Duplication & Harden Upsert Logic

**Version:** 1.0  
**Date:** 2026-06-13  
**Status:** Planning  
**Priority:** High (maintainability + data integrity)

---

## Problem Statement

The TCG Terminal database layer is implemented **twice** — once for native SQLite (`database/index.native.ts`, ~500 lines) and once for web localStorage (`database/index.ts`, ~560 lines). These files are **near-identical**, sharing the same function signatures, seed data, migration logic, upsert matching rules, and P&L queries. Every schema change, bug fix, or feature addition must be written twice, or worse — written once and drift over time.

Beyond the duplication, there is a **data integrity bug** in both: the `upsertCard` function can silently overwrite a card's `data_matrix` with an unrelated value when matching by ID. Since `data_matrix` serves as a secondary unique key for scanner lookups, this can break the scan→find→identify workflow.

### Concrete Examples

**Duplication:**

1. A `Card` type change (e.g., adding `description` field) requires updating:
   - `database/index.ts` — type definition, insertCard, updateCard, upsertCard, seed data, migration
   - `database/index.native.ts` — type definition, insertCard, updateCard, upsertCard, seed data, ALTER TABLE migration
   - `utils/csv.ts` — CSV headers, import field mapping, export row mapping
2. The `findCardByDataMatrix` function is ~15 lines of identical logic in both files.
3. The seed data (`SEED_CARDS` array with 12 Pokémon cards) is **literally copy-pasted** between both files.
4. The DataMatrix regex `/^\d{20,}$/` appears in **three** places (both databases + `csv.ts`).

**Upsert Conflict:**

1. Card #1 exists: `id=1, name="Charizard", data_matrix="01073..."`
2. User imports CSV containing: `id=1, name="Charizard", data_matrix="99999..."` (a different code)
3. `upsertCard` matches by ID → calls `updateCard(1, { data_matrix: "99999..." })`
4. Card #1 now has `data_matrix="99999..."` — the original `"01073..."` is **lost**
5. Existing physical label with `"01073..."` no longer matches this card on scan

---

## Goals

1. **Single source of truth for business logic.** Extract shared logic (upsert rules, seed data, scan lookups, P&L calculations) into a common module. Each platform backend becomes a thin **store adapter** (SQL queries or array operations).

2. **Eliminate copy-paste duplication.** Seed data, type definitions, constants (regexes, default values), and algorithm code exist in exactly one place.

3. **Defend data_matrix integrity.** Upsert must not silently overwrite an existing `data_matrix` when matching by ID. The system should log a warning, preserve the existing value, and require explicit user action to change it.

4. **Backward compatible.** No API changes for callers. All function signatures remain identical. Components in `app/` and `components/` require zero changes.

5. **No regression.** All existing behavior preserved: archiving, auto-archive-on-sale, sync mode, CSV import/export, scan lookups, seed data, migrations.

---

## Technical Design

### 1. New Architecture

```
database/
├── types.ts            # Card, CardInsert, CardFilters, Sale, PnLSummary, etc.
├── seed.ts             # SEED_CARDS, sampleTargets, seedIfEmpty logic
├── core.ts             # Platform-agnostic business logic (upsert rules, filtering, P&L math)
├── adapter.ts          # Interface: CardStore, SaleStore, SettingsStore
├── index.ts            # Web adapter implementation (localStorage arrays)
└── index.native.ts     # Native adapter implementation (expo-sqlite)
```

### 2. Type Extraction (`database/types.ts`)

Move all shared interfaces into one file. No behavioral changes:

```typescript
export interface Card {
  id: number;
  name: string;
  set_name: string;
  card_number: string | null;
  rarity: string | null;
  condition: string;
  price_paid: number;
  price_target: number;
  price_sold: number;
  quantity: number;
  purchase_date: string | null;
  notes: string | null;
  description: string | null;
  archived: number;
  archived_at: string | null;
  image_uri: string | null;
  data_matrix: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardInsert {
  name: string;
  set_name: string;
  card_number?: string;
  rarity?: string;
  condition?: string;
  price_paid: number;
  price_target?: number;
  price_sold?: number;
  quantity?: number;
  purchase_date?: string;
  notes?: string;
  description?: string;
  image_uri?: string;
  data_matrix?: string;
  tags?: string;
  archived?: number;
  archived_at?: string | null;
}

// ... Sale, SaleInsert, PnLSummary, OperationLog, EndOfDayReport, CardFilters
```

### 3. Seed Data Extraction (`database/seed.ts`)

Consolidate `SEED_CARDS` array and `sampleTargets` lookup. The native backend currently inlines `price_target` in each seed object; the web backend uses a separate `sampleTargets` map. Unify to the inline approach (simpler, one-pass):

```typescript
export const SEED_CARDS: CardInsert[] = [
  { name: 'Charizard', set_name: 'Base Set', card_number: '4/102', rarity: 'Holo Rare',
    condition: 'Near Mint', price_paid: 350.00, price_target: 500, quantity: 1,
    description: 'The iconic fire-breathing dragon from Base Set' },
  // ... 11 more
];

export async function seedIfEmpty(store: CardStore, settingsStore: SettingsStore): Promise<void> {
  const cleared = await settingsStore.get('cleared');
  if (cleared === '1') return;
  const count = await store.getCount();
  if (count > 0) return;
  for (const c of SEED_CARDS) {
    await store.insert(c);
  }
}
```

### 4. Core Business Logic (`database/core.ts`)

Extract platform-agnostic logic that currently lives identically in both files:

```typescript
import { Card, CardInsert, CardFilters } from './types';

/** Shared filtering logic (used by getAllCards in both adapters) */
export function applyCardFilters(cards: Card[], filters?: CardFilters): Card[] {
  let result = [...cards];
  if (!filters?.includeArchived) {
    result = result.filter(c => c.archived !== 1);
  }
  if (filters?.search) {
    const term = filters.search.toLowerCase();
    result = result.filter(c =>
      c.name.toLowerCase().includes(term) ||
      c.set_name.toLowerCase().includes(term) ||
      (c.card_number ?? '').toLowerCase().includes(term)
    );
  }
  // ... set_name, rarity, condition, minPrice, maxPrice
  result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return result;
}

/** Shared P&L math */
export function computePnLSummary(sales: Sale[]): PnLSummary { ... }
export function computePnLBySet(sales: Sale[]): { set_name: string; ... }[] { ... }
export function computePnLByCard(sales: Sale[]): { card_name: string; ... }[] { ... }
export function computeInvestmentBySet(cards: Card[]): { set_name: string; ... }[] { ... }

/** Shared upsert rules */
export async function upsertCard(
  store: CardStore,
  input: CardInsert & { id?: number }
): Promise<{ id: number; action: 'updated' | 'inserted' }> { ... }
```

### 5. Adapter Interface (`database/adapter.ts`)

Define the contract each backend must fulfill:

```typescript
export interface CardStore {
  getAll(filters?: CardFilters): Promise<Card[]>;
  getById(id: number): Promise<Card | null>;
  insert(card: CardInsert): Promise<number>;
  update(id: number, updates: Partial<CardInsert>): Promise<void>;
  delete(id: number): Promise<void>;
  deleteAll(): Promise<void>;
  deleteNotInList(ids: number[]): Promise<number>;
  getCount(): Promise<number>;
  findByDataMatrix(code: string): Promise<Card | null>;
  findByScanData(name: string, set_name: string, card_number?: string): Promise<Card[]>;
  getRecentActivity(limit: number): Promise<Card[]>;
  getTotalInvestment(): Promise<number>;
  getDistinctSets(): Promise<string[]>;
  getDistinctRarities(): Promise<string[]>;
  getInvestmentBySet(): Promise<{ set_name: string; total: number; count: number }[]>;
}

export interface SaleStore { ... }
export interface SettingsStore { ... }
export interface OperationsStore { ... }
export interface EodReportStore { ... }
```

### 6. Upsert: Defend data_matrix Integrity

**Current behavior (buggy):**
```
upsertCard({ id: 1, name: "Charizard", data_matrix: "new-code" })
→ matches by ID → calls updateCard(1, { ..., data_matrix: "new-code" })
→ old data_matrix is overwritten silently
```

**New behavior:**
```
upsertCard({ id: 1, name: "Charizard", data_matrix: "new-code" })
→ matches by ID → existing card has data_matrix = "old-code"
→ new data_matrix ("new-code") differs from existing → log warning, keep "old-code"
→ only update data_matrix if: (a) existing is NULL, or (b) new matches existing
```

Implementation in `core.ts`:

```typescript
export async function upsertCard(
  store: CardStore, input: CardInsert & { id?: number }
): Promise<{ id: number; action: 'updated' | 'inserted'; dmConflict?: boolean }> {
  // 1. Try match by ID
  if (input.id && input.id > 0) {
    const existing = await store.getById(input.id);
    if (existing) {
      // Guard: don't overwrite an existing data_matrix with a different one
      const updates = { ...input };
      if (existing.data_matrix && input.data_matrix && existing.data_matrix !== input.data_matrix) {
        console.warn(
          `upsertCard: data_matrix conflict for card #${input.id}. ` +
          `Keeping existing="${existing.data_matrix}", ignoring input="${input.data_matrix}"`
        );
        delete updates.data_matrix;
      }
      await store.update(input.id, updates);
      return { id: input.id, action: 'updated' };
    }
  }

  // 2. Try match by data_matrix
  if (input.data_matrix) {
    const existing = await store.findByDataMatrix(input.data_matrix);
    if (existing) {
      await store.update(existing.id, input);
      return { id: existing.id, action: 'updated' };
    }
  }

  // 3. Insert new
  const newId = await store.insert(input);
  return { id: newId, action: 'inserted' };
}
```

### 7. Constants Extraction

Move shared magic values into `database/core.ts` (or a `database/constants.ts`):

```typescript
export const DATAMATRIX_PATTERN = /^\d{20,}$/;
export const DEFAULT_CONDITION = 'Near Mint';
export const DEFAULT_QUANTITY = 1;
export const CONDITIONS = ['Mint', 'Near Mint', 'Excellent', 'Good', 'Light Played', 'Played', 'Poor'] as const;
```

---

## Files Changed

| File | Change |
|------|--------|
| `database/types.ts` | **NEW** — extract all shared interfaces (`Card`, `CardInsert`, `Sale`, `PnLSummary`, etc.) |
| `database/seed.ts` | **NEW** — consolidated `SEED_CARDS`, `seedIfEmpty` logic |
| `database/core.ts` | **NEW** — platform-agnostic logic: `upsertCard`, `applyCardFilters`, P&L math, shared constants |
| `database/adapter.ts` | **NEW** — `CardStore`, `SaleStore`, `SettingsStore`, `OperationsStore` interfaces |
| `database/index.ts` | **REFACTOR** — reimplement using `core.ts` + in-memory array adapter. ~560 → ~150 lines |
| `database/index.native.ts` | **REFACTOR** — reimplement using `core.ts` + SQLite adapter. ~500 → ~180 lines |
| `utils/csv.ts` | **MINOR** — import constants from `database/core` instead of inline regex |

**No changes required:** `app/`, `components/` — all callers use the same exported function signatures.

---

## Acceptance Criteria

- [ ] `database/types.ts` contains all shared interfaces, both adapters import from it (no duplicate declarations)
- [ ] `database/seed.ts` exports a single `SEED_CARDS` array; both adapters call the same `seedIfEmpty()`
- [ ] `database/core.ts` contains `upsertCard()`, `applyCardFilters()`, `computePnLSummary()`, and constants
- [ ] `database/adapter.ts` defines `CardStore`, `SaleStore`, `SettingsStore`, `OperationsStore`, `EodReportStore` interfaces
- [ ] `database/index.ts` implements all store interfaces using localStorage-backed arrays
- [ ] `database/index.native.ts` implements all store interfaces using `expo-sqlite`
- [ ] All existing function signatures (exported from `database/index*.ts`) remain unchanged
- [ ] `upsertCard` does **not** overwrite a non-null `data_matrix` when matching by ID with a different value
- [ ] `upsertCard` **does** overwrite `data_matrix` when existing is `NULL` (normal flow)
- [ ] `upsertCard` **does** overwrite `data_matrix` when input matches existing (idempotent)
- [ ] DataMatrix regex exists in exactly one place (`database/core.ts`)
- [ ] CSV import continues working with all upsert modes (ID match, data_matrix match, insert)
- [ ] CSV sync mode continues working (guarded against empty ID list — existing fix)
- [ ] Scanned DataMatrix codes find the correct card by `findCardByDataMatrix`
- [ ] All existing card operations (CRUD, archiving, filtering, P&L, EOD reports) behave identically
- [ ] Seed data populates on first launch for both platforms
- [ ] Migration logic preserved — existing databases upgrade correctly
- [ ] `tsc --noEmit` passes with zero errors

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Refactor introduces subtle behavior differences between platforms | High — users see different results on web vs native | Keep adapter interface minimal. Write unit tests for `core.ts` functions (platform-agnostic). Manual smoke-test both platforms before merge. |
| Existing localStorage data schema changes break on upgrade | Medium — web users lose data | Migration logic in `index.ts` already handles field additions. Keep migration code in the adapter, not in core. Test with existing localStorage payloads. |
| SQLite adapter abstraction adds overhead | Low — queries are already async | Direct SQL remains in `index.native.ts`. The adapter interface is thin — calls pass through with minimal indirection. |
| `upsertCard` data_matrix guard blocks legitimate updates | Medium — users who intentionally want to change a data_matrix can't via CSV | Add a `force_overwrite_data_matrix` flag to the CSV import modal (future PRD). For now, users can edit the card manually in the Inventory detail screen. |

---

## Out of Scope

- **Unit tests** — covered in a separate PRD (M7)
- **`upsertCard` force-overwrite flag in CSV UI** — manual card edit is the workaround; a dedicated `force_overwrite_data_matrix` column in CSV can be a fast-follow
- **Bulk operations API** — `deleteCardsNotInList` already exists; no new bulk methods
- **Database migration framework** — current ad-hoc `ALTER TABLE` try/catch pattern is preserved
- **IndexedDB** or other storage backends — only SQLite (native) and localStorage (web) are in scope
- **Real-time sync / cloud backup** — local-only remains the target

---

## Estimated Effort

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | Extract `types.ts`, `seed.ts`, `constants.ts` | 0.5 day |
| 2 | Extract `core.ts` (filters, P&L math, upsert) | 1 day |
| 3 | Define `adapter.ts` interfaces | 0.5 day |
| 4 | Refactor `index.ts` (web adapter) | 0.5 day |
| 5 | Refactor `index.native.ts` (SQLite adapter) | 0.5 day |
| 6 | Fix `upsertCard` data_matrix guard (in `core.ts`) | 0.25 day |
| 7 | Update `csv.ts` imports | 0.25 day |
| 8 | Manual testing (web + native, import/export, scanner, sales) | 1 day |
| **Total** | | **~4.5 days** |
