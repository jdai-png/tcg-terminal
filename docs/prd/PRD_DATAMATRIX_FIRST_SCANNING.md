# PRD: DataMatrix-First Scanning — TCG Terminal

**Version:** 1.0  
**Date:** 2026-06-12  
**Status:** Planning  
**Priority:** High (bug fix + UX improvement)

---

## Problem Statement

When scanning a raw DataMatrix code (e.g., `01073002362572271054256624020260342205021140610659072`), the scanner treats the entire code as the **card name** because it doesn't match JSON or pipe-delimited formats. This causes two failures:

1. **First scan**: The raw code is saved as `name`, with `data_matrix` left `NULL`. The user must manually edit the name afterward.

2. **Subsequent scans**: After the user fixes the name to something readable (e.g., "Charizard"), scanning the same DataMatrix code again does NOT find the card — because the lookup only matches by `name`, and the name was changed. The `data_matrix` field was never populated.

### Concrete Example

1. User scans DataMatrix: `01073002362572271054256624020260342205021140610659072`
2. Scanner parses as: `{ name: "01073002362572271054256624020260342205021140610659072", set_name: "" }`
3. User saves card → `name` = `"01073002362572271054256624020260342205021140610659072"`, `data_matrix` = `NULL`
4. User edits in Inventory: changes name to "Charizard", set to "Base Set"
5. User scans same DataMatrix again
6. Scanner searches for cards with `name = "01073002362572271054256624020260342205021140610659072"` → **no match** (name is now "Charizard")
7. `data_matrix` lookup never happens → card treated as new, duplicate created

---

## Goals

1. **DataMatrix-first matching**: When a raw DataMatrix code is scanned, first search by `data_matrix` field. If found, treat as "Card Found" (lookup mode).

2. **Store raw code in data_matrix**: When saving a card from a scan, always store the raw scanned code in the `data_matrix` field — even if the name/set are parsed from the code.

3. **Fallback name**: If no metadata can be parsed from the DataMatrix, prompt the user to enter a name instead of auto-filling with the raw numeric string.

4. **Backward compatible**: Existing cards with populated `data_matrix` should be found on rescan. Existing cards without `data_matrix` should still be findable by name/set/card_number.

---

## Technical Design

### 1. Scanner Parsing Changes

**File: `app/scanner.tsx`** (native) and **`app/scanner.web.tsx`** (web)

#### New `parseScanData` behavior:

```
For each scanned code:
  1. If JSON → parse normally (existing behavior)
  2. If pipe-delimited → parse normally (existing behavior)
  3. Else (raw code) → 
     a. Set rawCode = result.data.trim()
     b. Return { name: '', set_name: '', rawCode: rawCode }
     c. DO NOT use rawCode as the card name
```

#### New lookup flow after parsing:

```
  1. If parsedCard.dbId → try getCardById (existing)
  2. If parsedCard.rawCode → try findCardByDataMatrix(rawCode)
     a. If found → set foundCard, show "Card Found" overlay
     b. If not found → show "Register Card" with rawCode in data_matrix field
  3. Else → findCardsByScanData(name, set_name, card_number) (existing)
```

### 2. Add `findCardByDataMatrix` to Database

**Files: `database/index.ts` and `database/index.native.ts`**

```typescript
export async function findCardByDataMatrix(code: string): Promise<Card | null> {
  // Search exact match on data_matrix field
  const result = cards.find(c => c.data_matrix === code);
  return result ?? null;
}
```

### 3. Update `ScannedCard` Type

**File: `app/scanner.tsx`** and **`app/scanner.web.tsx`**

```typescript
interface ScannedCard {
  name: string;
  set_name: string;
  card_number?: string;
  dbId?: number;
  rawCode?: string;  // NEW: the raw DataMatrix string, stored in data_matrix
}
```

### 4. Update QuickAddOverlay

**File: `components/QuickAddOverlay.tsx`**

**`handleSaveNew`:** Always pass `rawCode` as `data_matrix` when saving:

```typescript
const card: CardInsert = {
  name: data.name || 'Unknown Card',
  set_name: data.set_name,
  card_number: data.card_number,
  price_paid: parsedPrice,
  condition: 'Near Mint',
  data_matrix: data.rawCode,  // Store the raw scan code
};
```

**Registration mode UI:** When `rawCode` is present but name is empty, show:
- A text field for the name (instead of auto-filling with raw code)
- Display the raw code below as "DataMatrix: ..."
- Allow editing before save

### 5. Update `handleAddAnother` in Lookup Mode

When adding another copy of an existing card, copy the `data_matrix` field:

```typescript
await insertCard({
  ...foundCard,
  data_matrix: foundCard.data_matrix,  // Preserve DataMatrix on copy
});
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/scanner.tsx` | Parse raw codes into `rawCode` field, search by `data_matrix` first |
| `app/scanner.web.tsx` | Same as native scanner |
| `database/index.ts` | Add `findCardByDataMatrix()` function |
| `database/index.native.ts` | Add `findCardByDataMatrix()` function |
| `components/QuickAddOverlay.tsx` | Pass `rawCode` to `data_matrix` when saving, show name input for raw scans |

---

## Acceptance Criteria

- [ ] Scanning a raw DataMatrix code does NOT auto-fill name with the numeric string
- [ ] Raw DataMatrix code is stored in `data_matrix` field on card save
- [ ] Scanning the same DataMatrix code again finds the card (even after name change)
- [ ] `findCardByDataMatrix()` returns the correct card on exact match
- [ ] Existing JSON/pipe-delimited scans continue to work unchanged
- [ ] QuickAddOverlay shows a name input field when only a raw code is available
- [ ] Scanning a known card (by data_matrix) shows "Card Found" overlay, not "Register"
- [ ] Duplicate cards are no longer created on rescan

---

## Out of Scope

- Fuzzy matching on DataMatrix (exact match only)
- Partial DataMatrix matching
- DataMatrix format validation/parsing (this is scanner hardware territory)
- QR code DataMatrix codes (existing JSON/pipe parsing unchanged)
