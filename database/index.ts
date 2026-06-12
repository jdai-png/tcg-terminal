// localStorage-persisted database for web platform
// Implements the same interface as database/index.native.ts
// Survives page refreshes — data stored in browser localStorage

// ---- Types ----

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

export interface CardFilters {
  search?: string;
  set_name?: string;
  rarity?: string;
  condition?: string;
  minPrice?: number;
  maxPrice?: number;
  includeArchived?: boolean;
}

export interface OperationLog {
  id: number;
  type: 'import' | 'export';
  status: 'success' | 'failure';
  record_count: number;
  file_name: string | null;
  error_message: string | null;
  created_at: string;
}

export interface Sale {
  id: number;
  card_id: number | null;
  card_name: string;
  set_name: string;
  card_number: string | null;
  rarity: string | null;
  condition: string;
  cost_basis: number;
  sale_price: number;
  quantity: number;
  profit: number;
  buyer_name: string | null;
  sale_date: string;
  notes: string | null;
  created_at: string;
}

export interface SaleInsert {
  card_id?: number;
  card_name: string;
  set_name: string;
  card_number?: string;
  rarity?: string;
  condition?: string;
  cost_basis: number;
  sale_price: number;
  quantity?: number;
  buyer_name?: string;
  sale_date?: string;
  notes?: string;
}

export interface PnLSummary {
  total_sales_revenue: number;
  total_cost_basis: number;
  gross_profit: number;
  total_sales_count: number;
  total_cards_sold: number;
  avg_roi_pct: number;
}

export interface EndOfDayReport {
  id: number;
  report_date: string;
  total_sales: number;
  total_sales_count: number;
  total_purchases: number;
  total_purchases_count: number;
  gross_profit: number;
  created_at: string;
}

// ---- localStorage keys ----

const STORAGE_KEY_CARDS = 'tcg_terminal_cards';
const STORAGE_KEY_OPS = 'tcg_terminal_operations';
const STORAGE_KEY_SALES = 'tcg_terminal_sales';
const STORAGE_KEY_EOD = 'tcg_terminal_eod_reports';
const STORAGE_KEY_META = 'tcg_terminal_meta';
const STORAGE_KEY_SETTINGS = 'tcg_terminal_settings';

// ---- In-memory store (synced to localStorage) ----

let cards: Card[] = [];
let operations: OperationLog[] = [];
let sales: Sale[] = [];
let eodReports: EndOfDayReport[] = [];
let nextCardId = 1;
let nextOpId = 1;
let nextSaleId = 1;
let nextEodId = 1;
let settings: Record<string, string> = {};

// ---- Persistence helpers ----

function loadFromStorage(): void {
  try {
    // Load meta (next IDs)
    const metaRaw = localStorage.getItem(STORAGE_KEY_META);
    if (metaRaw) {
      const meta = JSON.parse(metaRaw);
      nextCardId = meta.nextCardId || 1;
      nextOpId = meta.nextOpId || 1;
      nextSaleId = meta.nextSaleId || 1;
      nextEodId = meta.nextEodId || 1;
    }

    // Load cards
    const cardsRaw = localStorage.getItem(STORAGE_KEY_CARDS);
    if (cardsRaw) {
      cards = JSON.parse(cardsRaw);
      // Migration: ensure all cards have the new fields
      let migrated = false;
      for (const c of cards) {
        if (c.price_target === undefined) { c.price_target = 0; migrated = true; }
        if (c.price_sold === undefined) { c.price_sold = 0; migrated = true; }
        if (c.data_matrix === undefined) { c.data_matrix = null; migrated = true; }
        if (c.tags === undefined) { c.tags = null; migrated = true; }
        if (c.description === undefined) { c.description = null; migrated = true; }
        if (c.archived === undefined) { c.archived = 0; migrated = true; }
        if (c.archived_at === undefined) { c.archived_at = null; migrated = true; }
      }
      if (migrated) saveToStorage();
    }

    // Load operations
    const opsRaw = localStorage.getItem(STORAGE_KEY_OPS);
    if (opsRaw) {
      operations = JSON.parse(opsRaw);
    }

    // Load sales
    const salesRaw = localStorage.getItem(STORAGE_KEY_SALES);
    if (salesRaw) {
      sales = JSON.parse(salesRaw);
    }

    // Load EOD reports
    const eodRaw = localStorage.getItem(STORAGE_KEY_EOD);
    if (eodRaw) {
      eodReports = JSON.parse(eodRaw);
    }
  } catch {
    // Corrupted storage — reset
    cards = [];
    operations = [];
    sales = [];
    eodReports = [];
    nextCardId = 1;
    nextOpId = 1;
    nextSaleId = 1;
    nextEodId = 1;
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(cards));
    localStorage.setItem(STORAGE_KEY_OPS, JSON.stringify(operations));
    localStorage.setItem(STORAGE_KEY_SALES, JSON.stringify(sales));
    localStorage.setItem(STORAGE_KEY_EOD, JSON.stringify(eodReports));
    localStorage.setItem(STORAGE_KEY_META, JSON.stringify({ nextCardId, nextOpId, nextSaleId, nextEodId }));
  } catch (e) {
    // Storage full or unavailable — silently continue (data is in memory)
    console.warn('TCG Terminal: localStorage save failed', e);
  }
}

// Initialize on module load
loadFromStorage();
loadSettings();

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (raw) settings = JSON.parse(raw);
  } catch { settings = {}; }
}

function saveSettings(): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  } catch {}
}

function now(): string {
  return new Date().toISOString();
}

// ---- Seed data (only if empty) ----

const SEED_CARDS: CardInsert[] = [
  { name: 'Charizard', set_name: 'Base Set', card_number: '4/102', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 350.00, quantity: 1, description: 'The iconic fire-breathing dragon from Base Set' },
  { name: 'Blastoise', set_name: 'Base Set', card_number: '2/102', rarity: 'Holo Rare', condition: 'Good', price_paid: 85.00, quantity: 1, description: 'Powerful water-type tank' },
  { name: 'Venusaur', set_name: 'Base Set', card_number: '15/102', rarity: 'Holo Rare', condition: 'Light Played', price_paid: 60.00, quantity: 1, description: 'Grass-type powerhouse' },
  { name: 'Pikachu', set_name: 'Base Set', card_number: '58/102', rarity: 'Common', condition: 'Mint', price_paid: 12.00, quantity: 4, description: 'Fan-favorite electric mouse' },
  { name: 'Mewtwo', set_name: 'Base Set', card_number: '10/102', rarity: 'Holo Rare', condition: 'Excellent', price_paid: 120.00, quantity: 1, description: 'Legendary psychic powerhouse' },
  { name: 'Jolteon', set_name: 'Jungle', card_number: '4/64', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 45.00, quantity: 1, description: 'Lightning-fast electric Eeveelution' },
  { name: 'Vaporeon', set_name: 'Jungle', card_number: '12/64', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 40.00, quantity: 1, description: 'Graceful water Eeveelution' },
  { name: 'Flareon', set_name: 'Jungle', card_number: '3/64', rarity: 'Holo Rare', condition: 'Good', price_paid: 35.00, quantity: 1, description: 'Fiery Eeveelution' },
  { name: 'Gengar', set_name: 'Fossil', card_number: '5/62', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 55.00, quantity: 1, description: 'Spooky ghost-type from Fossil' },
  { name: 'Dragonite', set_name: 'Fossil', card_number: '4/62', rarity: 'Holo Rare', condition: 'Excellent', price_paid: 70.00, quantity: 1, description: 'Gentle dragon powerhouse' },
  { name: 'Lugia', set_name: 'Neo Genesis', card_number: '9/111', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 200.00, quantity: 1, description: 'Legendary guardian of the seas' },
  { name: 'Typhlosion', set_name: 'Neo Genesis', card_number: '18/111', rarity: 'Holo Rare', condition: 'Mint', price_paid: 90.00, quantity: 1, description: 'Volcanic fire-type from Neo Genesis' },
];

// ---- Public API ----

export async function getDatabase(): Promise<any> {
  return {};
}

export async function seedIfEmpty(): Promise<void> {
  // If user has intentionally cleared data, don't re-seed
  if (localStorage.getItem('tcg_terminal_cleared') === '1') return;
  if (cards.length > 0) return;
  const sampleTargets: Record<string, number> = {
    Charizard: 500, Blastoise: 130, Venusaur: 95, Pikachu: 18,
    Mewtwo: 180, Jolteon: 70, Vaporeon: 65, Flareon: 55,
    Gengar: 85, Dragonite: 110, Lugia: 300, Typhlosion: 140,
  };
  for (const c of SEED_CARDS) {
    cards.push({
      id: nextCardId++,
      name: c.name,
      set_name: c.set_name,
      card_number: c.card_number ?? null,
      rarity: c.rarity ?? null,
      condition: c.condition ?? 'Near Mint',
      price_paid: c.price_paid,
      price_target: sampleTargets[c.name] ?? 0,
      price_sold: 0,
      quantity: c.quantity ?? 1,
      purchase_date: c.purchase_date ?? null,
      notes: c.notes ?? null,
      image_uri: c.image_uri ?? null,
      data_matrix: null,
      tags: null,
      description: c.description ?? null,
      archived: 0,
      archived_at: null,
      created_at: now(),
      updated_at: now(),
    });
  }
  saveToStorage();
}

export async function getAllCards(filters?: CardFilters): Promise<Card[]> {
  let result = [...cards];

  // Filter out archived cards by default
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
  if (filters?.set_name) result = result.filter(c => c.set_name === filters.set_name);
  if (filters?.rarity) result = result.filter(c => c.rarity === filters.rarity);
  if (filters?.condition) result = result.filter(c => c.condition === filters.condition);
  if (filters?.minPrice !== undefined) result = result.filter(c => c.price_paid >= filters.minPrice!);
  if (filters?.maxPrice !== undefined) result = result.filter(c => c.price_paid <= filters.maxPrice!);

  result.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return result;
}

export async function getCardById(id: number): Promise<Card | null> {
  return cards.find(c => c.id === id) ?? null;
}

export async function insertCard(card: CardInsert): Promise<number> {
  const id = nextCardId++;
  const ts = now();
  cards.push({
    id,
    name: card.name,
    set_name: card.set_name,
    card_number: card.card_number ?? null,
    rarity: card.rarity ?? null,
    condition: card.condition ?? 'Near Mint',
    price_paid: card.price_paid,
    price_target: card.price_target ?? 0,
    price_sold: card.price_sold ?? 0,
    quantity: card.quantity ?? 1,
    purchase_date: card.purchase_date ?? null,
    notes: card.notes ?? null,
    description: card.description ?? null,
    archived: 0,
    archived_at: null,
    image_uri: card.image_uri ?? null,
    data_matrix: card.data_matrix ?? null,
    tags: card.tags ?? null,
    created_at: ts,
    updated_at: ts,
  });
  saveToStorage();
  return id;
}

export async function updateCard(id: number, updates: Partial<CardInsert>): Promise<void> {
  const idx = cards.findIndex(c => c.id === id);
  if (idx === -1) return;
  const card = cards[idx];
  if (updates.name !== undefined) card.name = updates.name;
  if (updates.set_name !== undefined) card.set_name = updates.set_name;
  if (updates.card_number !== undefined) card.card_number = updates.card_number;
  if (updates.rarity !== undefined) card.rarity = updates.rarity;
  if (updates.condition !== undefined) card.condition = updates.condition;
  if (updates.price_paid !== undefined) card.price_paid = updates.price_paid;
  if (updates.price_target !== undefined) card.price_target = updates.price_target;
  if (updates.price_sold !== undefined) card.price_sold = updates.price_sold;
  if (updates.quantity !== undefined) card.quantity = updates.quantity;
  if (updates.purchase_date !== undefined) card.purchase_date = updates.purchase_date;
  if (updates.notes !== undefined) card.notes = updates.notes;
  if (updates.image_uri !== undefined) card.image_uri = updates.image_uri;
  if (updates.data_matrix !== undefined) card.data_matrix = updates.data_matrix;
  if (updates.tags !== undefined) card.tags = updates.tags;
  if (updates.description !== undefined) card.description = updates.description;
  if (updates.archived !== undefined) card.archived = updates.archived;
  if (updates.archived_at !== undefined) card.archived_at = updates.archived_at;
  card.updated_at = now();
  saveToStorage();
}

/**
 * Upsert a card from CSV import data.
 * - If an 'id' is provided and > 0, update the card with that id.
 * - Else if 'data_matrix' is provided, find and update the card with matching data_matrix.
 * - Otherwise, insert as a new card.
 * Returns { id, action: 'updated' | 'inserted' }
 */
export async function upsertCard(card: CardInsert & { id?: number }): Promise<{ id: number; action: 'updated' | 'inserted' }> {
  // 1. Try to match by explicit ID
  if (card.id && card.id > 0) {
    const existing = cards.findIndex(c => c.id === card.id);
    if (existing !== -1) {
      await updateCard(card.id, card);
      return { id: card.id, action: 'updated' };
    }
  }

  // 2. Try to match by data_matrix
  if (card.data_matrix) {
    const existing = cards.findIndex(c => c.data_matrix === card.data_matrix);
    if (existing !== -1) {
      const existingId = cards[existing].id;
      await updateCard(existingId, card);
      return { id: existingId, action: 'updated' };
    }
  }

  // 3. Insert new
  const newId = await insertCard(card);
  return { id: newId, action: 'inserted' };
}

export async function deleteCard(id: number): Promise<void> {
  cards = cards.filter(c => c.id !== id);
  saveToStorage();
}

export async function deleteAllCards(): Promise<void> {
  cards = [];
  settings = {};
  saveSettings();
  saveToStorage();
}

/** Delete cards whose IDs are NOT in the given list */
export async function deleteCardsNotInList(ids: number[]): Promise<number> {
  const before = cards.length;
  const idSet = new Set(ids);
  cards = cards.filter(c => idSet.has(c.id));
  const removed = before - cards.length;
  if (removed > 0) saveToStorage();
  return removed;
}

export async function getCardCount(): Promise<number> {
  return cards.length;
}

// ---- Scan Lookup ----

export async function findCardsByScanData(
  name: string,
  set_name: string,
  card_number?: string
): Promise<Card[]> {
  if (card_number) {
    const exact = cards.filter(
      c => c.name === name && c.set_name === set_name && c.card_number === card_number
    );
    if (exact.length > 0) return exact.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  // If set_name is empty, match on name only (raw DataMatrix codes)
  if (set_name) {
    return cards
      .filter(c => c.name === name && c.set_name === set_name)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
  return cards
    .filter(c => c.name === name)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Find a single card by exact match on data_matrix field */
export async function findCardByDataMatrix(code: string): Promise<Card | null> {
  if (!code || code.trim().length === 0) return null;
  const trimmed = code.trim();
  return cards.find(c => c.data_matrix === trimmed) ?? null;
}

export async function getTotalInvestment(): Promise<number> {
  return cards.reduce((sum, c) => sum + c.price_paid * c.quantity, 0);
}

export async function getDistinctSets(): Promise<string[]> {
  return [...new Set(cards.map(c => c.set_name))].sort();
}

export async function getDistinctRarities(): Promise<string[]> {
  return [...new Set(cards.map(c => c.rarity).filter(Boolean) as string[])].sort();
}

export async function getRecentActivity(limit: number = 10): Promise<Card[]> {
  return [...cards].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit);
}

export async function getInvestmentBySet(): Promise<{ set_name: string; total: number; count: number }[]> {
  const map = new Map<string, { total: number; count: number }>();
  for (const c of cards) {
    const entry = map.get(c.set_name) || { total: 0, count: 0 };
    entry.total += c.price_paid * c.quantity;
    entry.count++;
    map.set(c.set_name, entry);
  }
  return [...map.entries()]
    .map(([set_name, v]) => ({ set_name, ...v }))
    .sort((a, b) => b.total - a.total);
}

// ---- Operations Log ----

export async function logOperation(
  type: 'import' | 'export',
  status: 'success' | 'failure',
  recordCount: number,
  fileName?: string,
  errorMessage?: string
): Promise<void> {
  operations.push({
    id: nextOpId++,
    type,
    status,
    record_count: recordCount,
    file_name: fileName ?? null,
    error_message: errorMessage ?? null,
    created_at: now(),
  });
  saveToStorage();
}

export async function getOperationHistory(): Promise<OperationLog[]> {
  return [...operations].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 50);
}

// ---- Sales CRUD ----

export async function recordSale(saleInsert: SaleInsert): Promise<number> {
  const id = nextSaleId++;
  const quantity = saleInsert.quantity ?? 1;
  const profit = (saleInsert.sale_price - saleInsert.cost_basis) * quantity;
  const ts = now();
  const saleDate = saleInsert.sale_date || new Date().toISOString().slice(0, 10);
  sales.push({
    id,
    card_id: saleInsert.card_id ?? null,
    card_name: saleInsert.card_name,
    set_name: saleInsert.set_name,
    card_number: saleInsert.card_number ?? null,
    rarity: saleInsert.rarity ?? null,
    condition: saleInsert.condition ?? 'Near Mint',
    cost_basis: saleInsert.cost_basis,
    sale_price: saleInsert.sale_price,
    quantity,
    profit,
    buyer_name: saleInsert.buyer_name ?? null,
    sale_date: saleDate,
    notes: saleInsert.notes ?? null,
    created_at: ts,
  });

  // Decrement card quantity and auto-archive if depleted
  if (saleInsert.card_id) {
    const cardIdx = cards.findIndex(c => c.id === saleInsert.card_id);
    if (cardIdx !== -1) {
      cards[cardIdx].quantity = Math.max(0, cards[cardIdx].quantity - quantity);
      if (cards[cardIdx].quantity === 0) {
        cards[cardIdx].archived = 1;
        cards[cardIdx].archived_at = now();
      }
    }
  }

  saveToStorage();
  return id;
}

export async function getSalesHistory(limit: number = 50, offset: number = 0, from?: string, to?: string): Promise<Sale[]> {
  let filtered = [...sales];
  if (from) filtered = filtered.filter(s => s.sale_date >= from);
  if (to) filtered = filtered.filter(s => s.sale_date <= to);
  return filtered
    .sort((a, b) => {
      const dateCmp = b.sale_date.localeCompare(a.sale_date);
      if (dateCmp !== 0) return dateCmp;
      return b.created_at.localeCompare(a.created_at);
    })
    .slice(offset, offset + limit);
}

export async function getSalesByCard(cardId: number): Promise<Sale[]> {
  return sales
    .filter(s => s.card_id === cardId)
    .sort((a, b) => b.sale_date.localeCompare(a.sale_date));
}

export async function deleteSale(id: number): Promise<void> {
  sales = sales.filter(s => s.id !== id);
  saveToStorage();
}

// ---- P&L / Reports ----

export async function getPnLSummary(from?: string, to?: string): Promise<PnLSummary> {
  let filtered = [...sales];
  if (from) filtered = filtered.filter(s => s.sale_date >= from);
  if (to) filtered = filtered.filter(s => s.sale_date <= to);
  const total_sales_revenue = filtered.reduce((sum, s) => sum + s.sale_price * s.quantity, 0);
  const total_cost_basis = filtered.reduce((sum, s) => sum + s.cost_basis * s.quantity, 0);
  const total_cards_sold = filtered.reduce((sum, s) => sum + s.quantity, 0);
  const avg_roi_pct = total_cost_basis > 0 ? ((total_sales_revenue - total_cost_basis) / total_cost_basis) * 100 : 0;
  return {
    total_sales_revenue,
    total_cost_basis,
    gross_profit: total_sales_revenue - total_cost_basis,
    total_sales_count: filtered.length,
    total_cards_sold,
    avg_roi_pct,
  };
}

export async function getPnLBySet(from?: string, to?: string): Promise<{ set_name: string; revenue: number; cost: number; profit: number; count: number }[]> {
  let filtered = [...sales];
  if (from) filtered = filtered.filter(s => s.sale_date >= from);
  if (to) filtered = filtered.filter(s => s.sale_date <= to);
  const map = new Map<string, { revenue: number; cost: number; profit: number; count: number }>();
  for (const s of filtered) {
    const entry = map.get(s.set_name) || { revenue: 0, cost: 0, profit: 0, count: 0 };
    entry.revenue += s.sale_price * s.quantity;
    entry.cost += s.cost_basis * s.quantity;
    entry.profit += s.profit;
    entry.count++;
    map.set(s.set_name, entry);
  }
  return [...map.entries()]
    .map(([set_name, v]) => ({ set_name, ...v }))
    .sort((a, b) => b.profit - a.profit);
}

export async function getPnLByCard(from?: string, to?: string): Promise<{ card_name: string; set_name: string; revenue: number; cost: number; profit: number; count: number }[]> {
  let filtered = [...sales];
  if (from) filtered = filtered.filter(s => s.sale_date >= from);
  if (to) filtered = filtered.filter(s => s.sale_date <= to);
  const map = new Map<string, { card_name: string; set_name: string; revenue: number; cost: number; profit: number; count: number }>();
  for (const s of filtered) {
    const key = `${s.card_name}||${s.set_name}`;
    const entry = map.get(key) || { card_name: s.card_name, set_name: s.set_name, revenue: 0, cost: 0, profit: 0, count: 0 };
    entry.revenue += s.sale_price * s.quantity;
    entry.cost += s.cost_basis * s.quantity;
    entry.profit += s.profit;
    entry.count++;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.profit - a.profit).slice(0, 20);
}

// ---- End of Day Reports ----

export async function generateEndOfDayReport(dateStr?: string): Promise<EndOfDayReport> {
  const reportDate = dateStr || new Date().toISOString().slice(0, 10);

  const daySales = sales.filter(s => s.sale_date === reportDate);
  const total_sales = daySales.reduce((sum, s) => sum + s.sale_price * s.quantity, 0);
  const total_sales_count = daySales.length;

  const dayPurchases = cards.filter(c => c.created_at.slice(0, 10) === reportDate);
  const total_purchases = dayPurchases.reduce((sum, c) => sum + c.price_paid * c.quantity, 0);
  const total_purchases_count = dayPurchases.length;

  const gross_profit = total_sales - total_purchases;

  const existingIdx = eodReports.findIndex(r => r.report_date === reportDate);
  if (existingIdx >= 0) {
    eodReports[existingIdx] = {
      ...eodReports[existingIdx],
      total_sales,
      total_sales_count,
      total_purchases,
      total_purchases_count,
      gross_profit,
      created_at: now(),
    };
    saveToStorage();
    return eodReports[existingIdx];
  }

  const report: EndOfDayReport = {
    id: nextEodId++,
    report_date: reportDate,
    total_sales,
    total_sales_count,
    total_purchases,
    total_purchases_count,
    gross_profit,
    created_at: now(),
  };
  eodReports.push(report);
  saveToStorage();
  return report;
}

export async function getEndOfDayReport(dateStr: string): Promise<EndOfDayReport | null> {
  return eodReports.find(r => r.report_date === dateStr) ?? null;
}

export async function getEndOfDayReportHistory(limit: number = 30): Promise<EndOfDayReport[]> {
  return [...eodReports]
    .sort((a, b) => b.report_date.localeCompare(a.report_date))
    .slice(0, limit);
}

export async function getSalesForDate(dateStr: string): Promise<Sale[]> {
  return sales
    .filter(s => s.sale_date === dateStr)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

// ---- Export helper: clear all data (reset) ----

export async function resetDatabase(): Promise<void> {
  cards = [];
  operations = [];
  sales = [];
  eodReports = [];
  nextCardId = 1;
  nextOpId = 1;
  nextSaleId = 1;
  nextEodId = 1;
  settings = {};
  // Mark as intentionally cleared so seed doesn't re-trigger on refresh
  localStorage.setItem('tcg_terminal_cleared', '1');
  try {
    localStorage.removeItem(STORAGE_KEY_CARDS);
    localStorage.removeItem(STORAGE_KEY_OPS);
    localStorage.removeItem(STORAGE_KEY_SALES);
    localStorage.removeItem(STORAGE_KEY_EOD);
    localStorage.removeItem(STORAGE_KEY_META);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
  } catch {}
}

// ---- Settings ----

export async function getAppSettings(): Promise<Record<string, string>> {
  return { ...settings };
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  settings[key] = value;
  saveSettings();
}
