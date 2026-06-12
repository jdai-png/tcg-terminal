// Database schema and initialization for TCG Terminal
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('tcg_terminal.db');
  await initializeSchema(db);
  return db;
}

async function initializeSchema(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      set_name TEXT NOT NULL,
      card_number TEXT,
      rarity TEXT,
      condition TEXT CHECK(condition IN ('Mint','Near Mint','Excellent','Good','Light Played','Played','Poor')) DEFAULT 'Near Mint',
      price_paid REAL NOT NULL DEFAULT 0,
      price_target REAL NOT NULL DEFAULT 0,
      price_sold REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      purchase_date TEXT,
      notes TEXT,
      image_uri TEXT,
      data_matrix TEXT,
      tags TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS operations_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('import','export')),
      status TEXT NOT NULL CHECK(status IN ('success','failure')),
      record_count INTEGER NOT NULL DEFAULT 0,
      file_name TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER REFERENCES cards(id) ON DELETE SET NULL,
      card_name TEXT NOT NULL,
      set_name TEXT NOT NULL,
      card_number TEXT,
      rarity TEXT,
      condition TEXT,
      cost_basis REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      profit REAL NOT NULL DEFAULT 0,
      buyer_name TEXT,
      sale_date TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS end_of_day_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL UNIQUE,
      total_sales REAL NOT NULL DEFAULT 0,
      total_sales_count INTEGER NOT NULL DEFAULT 0,
      total_purchases REAL NOT NULL DEFAULT 0,
      total_purchases_count INTEGER NOT NULL DEFAULT 0,
      gross_profit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cards_name ON cards(name);
    CREATE INDEX IF NOT EXISTS idx_cards_set_name ON cards(set_name);
    CREATE INDEX IF NOT EXISTS idx_cards_rarity ON cards(rarity);
    CREATE INDEX IF NOT EXISTS idx_cards_price_paid ON cards(price_paid);
    CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at);
    CREATE INDEX IF NOT EXISTS idx_cards_data_matrix ON cards(data_matrix);
    CREATE INDEX IF NOT EXISTS idx_operations_log_created_at ON operations_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_card_id ON sales(card_id);
  `);

  // Migration: add columns that may be missing from older schema
  const migrations = [
    'ALTER TABLE cards ADD COLUMN price_target REAL NOT NULL DEFAULT 0',
    'ALTER TABLE cards ADD COLUMN price_sold REAL NOT NULL DEFAULT 0',
    'ALTER TABLE cards ADD COLUMN data_matrix TEXT',
    'ALTER TABLE cards ADD COLUMN tags TEXT',
  ];
  for (const sql of migrations) {
    try { await database.execAsync(sql); } catch { /* column already exists */ }
  }
  try { await database.execAsync('CREATE INDEX IF NOT EXISTS idx_cards_data_matrix ON cards(data_matrix)'); } catch {}
  try { await database.execAsync('ALTER TABLE cards ADD COLUMN description TEXT'); } catch {}
  try { await database.execAsync('ALTER TABLE cards ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'); } catch {}
  try { await database.execAsync('ALTER TABLE cards ADD COLUMN archived_at TEXT'); } catch {}

  // Migration: move DataMatrix-like names to data_matrix field (one-time)
  // Cards previously saved with raw DataMatrix codes as names
  try {
    await database.execAsync(
      "UPDATE cards SET data_matrix = name, name = '' WHERE name GLOB '[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]*' AND data_matrix IS NULL AND length(name) >= 20"
    );
  } catch { /* migration already applied or no rows match */ }
}

// ---- Card CRUD ----

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

export async function getAllCards(filters?: CardFilters): Promise<Card[]> {
  const database = await getDatabase();
  let query = 'SELECT * FROM cards WHERE 1=1';
  const params: any[] = [];

  if (filters?.search) {
    query += ' AND (name LIKE ? OR set_name LIKE ? OR card_number LIKE ?)';
    const term = `%${filters.search}%`;
    params.push(term, term, term);
  }
  if (filters?.set_name) {
    query += ' AND set_name = ?';
    params.push(filters.set_name);
  }
  if (filters?.rarity) {
    query += ' AND rarity = ?';
    params.push(filters.rarity);
  }
  if (filters?.condition) {
    query += ' AND condition = ?';
    params.push(filters.condition);
  }
  if (filters?.minPrice !== undefined) {
    query += ' AND price_paid >= ?';
    params.push(filters.minPrice);
  }
  if (filters?.maxPrice !== undefined) {
    query += ' AND price_paid <= ?';
    params.push(filters.maxPrice);
  }
  if (!filters?.includeArchived) {
    query += ' AND archived = 0';
  }

  query += ' ORDER BY updated_at DESC';
  return database.getAllAsync<Card>(query, params);
}

export async function getCardById(id: number): Promise<Card | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<Card>(
    'SELECT * FROM cards WHERE id = ?',
    [id]
  );
  return result ?? null;
}

export async function insertCard(card: CardInsert): Promise<number> {
  const database = await getDatabase();
  const params: (string | number | null)[] = [
    card.name,
    card.set_name,
    card.card_number ?? null,
    card.rarity ?? null,
    card.condition ?? 'Near Mint',
    card.price_paid,
    card.price_target ?? 0,
    card.price_sold ?? 0,
    card.quantity ?? 1,
    card.purchase_date ?? null,
    card.notes ?? null,
    card.description ?? null,
    card.image_uri ?? null,
    card.data_matrix ?? null,
    card.tags ?? null,
  ];
  const result = await database.runAsync(
    `INSERT INTO cards (name, set_name, card_number, rarity, condition, price_paid, price_target, price_sold, quantity, purchase_date, notes, description, image_uri, data_matrix, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params as any
  );
  return result.lastInsertRowId;
}

export async function updateCard(id: number, updates: Partial<CardInsert>): Promise<void> {
  const database = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.set_name !== undefined) { fields.push('set_name = ?'); values.push(updates.set_name); }
  if (updates.card_number !== undefined) { fields.push('card_number = ?'); values.push(updates.card_number); }
  if (updates.rarity !== undefined) { fields.push('rarity = ?'); values.push(updates.rarity); }
  if (updates.condition !== undefined) { fields.push('condition = ?'); values.push(updates.condition); }
  if (updates.price_paid !== undefined) { fields.push('price_paid = ?'); values.push(updates.price_paid); }
  if (updates.price_target !== undefined) { fields.push('price_target = ?'); values.push(updates.price_target); }
  if (updates.price_sold !== undefined) { fields.push('price_sold = ?'); values.push(updates.price_sold); }
  if (updates.quantity !== undefined) { fields.push('quantity = ?'); values.push(updates.quantity); }
  if (updates.purchase_date !== undefined) { fields.push('purchase_date = ?'); values.push(updates.purchase_date); }
  if (updates.notes !== undefined) { fields.push('notes = ?'); values.push(updates.notes); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.archived !== undefined) { fields.push('archived = ?'); values.push(updates.archived); }
  if (updates.archived_at !== undefined) { fields.push('archived_at = ?'); values.push(updates.archived_at); }
  if (updates.image_uri !== undefined) { fields.push('image_uri = ?'); values.push(updates.image_uri); }
  if (updates.data_matrix !== undefined) { fields.push('data_matrix = ?'); values.push(updates.data_matrix); }
  if (updates.tags !== undefined) { fields.push('tags = ?'); values.push(updates.tags); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await database.runAsync(
    `UPDATE cards SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Upsert a card from CSV import data.
 * - If an 'id' is provided and > 0, update the card with that id.
 * - Else if 'data_matrix' is provided, find and update the card with matching data_matrix.
 * - Otherwise, insert as a new card.
 * Returns { id, action: 'updated' | 'inserted' }
 */
export async function upsertCard(card: CardInsert & { id?: number }): Promise<{ id: number; action: 'updated' | 'inserted' }> {
  const database = await getDatabase();

  // 1. Try to match by explicit ID
  if (card.id && card.id > 0) {
    const existing = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM cards WHERE id = ?', [card.id]
    );
    if (existing) {
      await updateCard(card.id, card);
      return { id: card.id, action: 'updated' };
    }
  }

  // 2. Try to match by data_matrix
  if (card.data_matrix) {
    const existing = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM cards WHERE data_matrix = ?', [card.data_matrix]
    );
    if (existing) {
      await updateCard(existing.id, card);
      return { id: existing.id, action: 'updated' };
    }
  }

  // 3. Insert new
  const newId = await insertCard(card);
  return { id: newId, action: 'inserted' };
}

export async function deleteCard(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cards WHERE id = ?', [id]);
}

export async function deleteAllCards(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM cards');
}

/** Delete cards whose IDs are NOT in the given list. Returns count of removed cards. */
export async function deleteCardsNotInList(ids: number[]): Promise<number> {
  const database = await getDatabase();
  if (ids.length === 0) {
    // If no IDs provided, delete everything
    const count = await getCardCount();
    await database.runAsync('DELETE FROM cards');
    return count;
  }
  const placeholders = ids.map(() => '?').join(',');
  const before = await getCardCount();
  await database.runAsync(
    `DELETE FROM cards WHERE id NOT IN (${placeholders})`,
    ids as any
  );
  const after = await getCardCount();
  return before - after;
}

export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sales');
  await database.runAsync('DELETE FROM cards');
  await database.runAsync('DELETE FROM operations_log');
  await database.runAsync('DELETE FROM end_of_day_reports');
  // Mark as intentionally cleared so seed doesn't re-trigger
  await database.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('cleared', '1')"
  );
}

export async function getCardCount(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM cards'
  );
  return result?.count ?? 0;
}

// ---- Scan Lookup ----

/** Find existing cards matching scanned data (name + set + optional card number) */
export async function findCardsByScanData(
  name: string,
  set_name: string,
  card_number?: string
): Promise<Card[]> {
  const database = await getDatabase();
  if (card_number) {
    const results = await database.getAllAsync<Card>(
      'SELECT * FROM cards WHERE name = ? AND set_name = ? AND card_number = ? ORDER BY updated_at DESC',
      [name, set_name, card_number]
    );
    if (results.length > 0) return results;
  }
  // If set_name is empty, match on name only (raw DataMatrix codes)
  if (set_name) {
    return database.getAllAsync<Card>(
      'SELECT * FROM cards WHERE name = ? AND set_name = ? ORDER BY updated_at DESC',
      [name, set_name]
    );
  }
  return database.getAllAsync<Card>(
    'SELECT * FROM cards WHERE name = ? ORDER BY updated_at DESC',
    [name]
  );
}

/** Find a single card by exact match on data_matrix field */
export async function findCardByDataMatrix(code: string): Promise<Card | null> {
  if (!code || code.trim().length === 0) return null;
  const database = await getDatabase();
  const result = await database.getFirstAsync<Card>(
    'SELECT * FROM cards WHERE data_matrix = ?',
    [code.trim()]
  );
  return result ?? null;
}

// ---- Aggregation Queries ----

export async function getTotalInvestment(): Promise<number> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ total: number }>(
    'SELECT COALESCE(SUM(price_paid * quantity), 0) as total FROM cards'
  );
  return result?.total ?? 0;
}

export async function getDistinctSets(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ set_name: string }>(
    'SELECT DISTINCT set_name FROM cards ORDER BY set_name'
  );
  return rows.map(r => r.set_name);
}

export async function getDistinctRarities(): Promise<string[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ rarity: string }>(
    'SELECT DISTINCT rarity FROM cards WHERE rarity IS NOT NULL ORDER BY rarity'
  );
  return rows.map(r => r.rarity);
}

export async function getRecentActivity(limit: number = 10): Promise<Card[]> {
  const database = await getDatabase();
  return database.getAllAsync<Card>(
    'SELECT * FROM cards ORDER BY updated_at DESC LIMIT ?',
    [limit]
  );
}

export async function getInvestmentBySet(): Promise<{ set_name: string; total: number; count: number }[]> {
  const database = await getDatabase();
  return database.getAllAsync<{ set_name: string; total: number; count: number }>(
    `SELECT set_name, SUM(price_paid * quantity) as total, COUNT(*) as count
     FROM cards GROUP BY set_name ORDER BY total DESC`
  );
}

// ---- Operations Log ----

export interface OperationLog {
  id: number;
  type: 'import' | 'export';
  status: 'success' | 'failure';
  record_count: number;
  file_name: string | null;
  error_message: string | null;
  created_at: string;
}

export async function logOperation(
  type: 'import' | 'export',
  status: 'success' | 'failure',
  recordCount: number,
  fileName?: string,
  errorMessage?: string
): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO operations_log (type, status, record_count, file_name, error_message)
     VALUES (?, ?, ?, ?, ?)`,
    [type, status, recordCount, fileName ?? null, errorMessage ?? null]
  );
}

export async function getOperationHistory(): Promise<OperationLog[]> {
  const database = await getDatabase();
  return database.getAllAsync<OperationLog>(
    'SELECT * FROM operations_log ORDER BY created_at DESC LIMIT 50'
  );
}

// ---- Settings ----

export async function getAppSettings(): Promise<Record<string, string>> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}

// ---- Sales CRUD ----

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

export async function recordSale(sale: SaleInsert): Promise<number> {
  const database = await getDatabase();
  const quantity = sale.quantity ?? 1;
  const profit = (sale.sale_price - sale.cost_basis) * quantity;
  const saleDate = sale.sale_date || new Date().toISOString().slice(0, 10);
  const result = await database.runAsync(
    `INSERT INTO sales (card_id, card_name, set_name, card_number, rarity, condition, cost_basis, sale_price, quantity, profit, buyer_name, sale_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sale.card_id ?? null,
      sale.card_name,
      sale.set_name,
      sale.card_number ?? null,
      sale.rarity ?? null,
      sale.condition ?? 'Near Mint',
      sale.cost_basis,
      sale.sale_price,
      quantity,
      profit,
      sale.buyer_name ?? null,
      saleDate,
      sale.notes ?? null,
    ]
  );
  // Decrement card inventory and auto-archive if depleted
  if (sale.card_id) {
    await database.runAsync(
      'UPDATE cards SET quantity = quantity - ?, updated_at = datetime(\'now\') WHERE id = ?',
      [quantity, sale.card_id]
    );
    const card = await database.getFirstAsync<{ quantity: number }>(
      'SELECT quantity FROM cards WHERE id = ?', [sale.card_id]
    );
    if (card && card.quantity <= 0) {
      await database.runAsync(
        "UPDATE cards SET archived = 1, archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
        [sale.card_id]
      );
    }
  }
  return result.lastInsertRowId;
}

export async function getSalesHistory(limit: number = 50, offset: number = 0, from?: string, to?: string): Promise<Sale[]> {
  const database = await getDatabase();
  let query = 'SELECT * FROM sales WHERE 1=1';
  const params: any[] = [];
  if (from) { query += ' AND sale_date >= ?'; params.push(from); }
  if (to) { query += ' AND sale_date <= ?'; params.push(to); }
  query += ' ORDER BY sale_date DESC, created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  return database.getAllAsync<Sale>(query, params);
}

export async function getSalesByCard(cardId: number): Promise<Sale[]> {
  const database = await getDatabase();
  return database.getAllAsync<Sale>(
    'SELECT * FROM sales WHERE card_id = ? ORDER BY sale_date DESC',
    [cardId]
  );
}

export async function deleteSale(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM sales WHERE id = ?', [id]);
}

// ---- P&L / Reports ----

export interface PnLSummary {
  total_sales_revenue: number;
  total_cost_basis: number;
  gross_profit: number;
  total_sales_count: number;
  total_cards_sold: number;
  avg_roi_pct: number;
}

export async function getPnLSummary(from?: string, to?: string): Promise<PnLSummary> {
  const database = await getDatabase();
  let query = `SELECT
       COALESCE(SUM(sale_price * quantity), 0) as total_sales_revenue,
       COALESCE(SUM(cost_basis * quantity), 0) as total_cost_basis,
       COUNT(*) as total_sales_count,
       COALESCE(SUM(quantity), 0) as total_cards_sold
     FROM sales WHERE 1=1`;
  const params: string[] = [];
  if (from) { query += ' AND sale_date >= ?'; params.push(from); }
  if (to) { query += ' AND sale_date <= ?'; params.push(to); }
  const row = await database.getFirstAsync<{
    total_sales_revenue: number;
    total_cost_basis: number;
    total_sales_count: number;
    total_cards_sold: number;
  }>(query, params);
  const tr = row?.total_sales_revenue ?? 0;
  const tc = row?.total_cost_basis ?? 0;
  const avgRoi = tc > 0 ? ((tr - tc) / tc) * 100 : 0;
  return {
    total_sales_revenue: tr,
    total_cost_basis: tc,
    gross_profit: tr - tc,
    total_sales_count: row?.total_sales_count ?? 0,
    total_cards_sold: row?.total_cards_sold ?? 0,
    avg_roi_pct: avgRoi,
  };
}

export async function getPnLBySet(from?: string, to?: string): Promise<{ set_name: string; revenue: number; cost: number; profit: number; count: number }[]> {
  const database = await getDatabase();
  let query = `SELECT
       set_name,
       COALESCE(SUM(sale_price * quantity), 0) as revenue,
       COALESCE(SUM(cost_basis * quantity), 0) as cost,
       COALESCE(SUM(profit), 0) as profit,
       COUNT(*) as count
     FROM sales WHERE 1=1`;
  const params: string[] = [];
  if (from) { query += ' AND sale_date >= ?'; params.push(from); }
  if (to) { query += ' AND sale_date <= ?'; params.push(to); }
  query += ' GROUP BY set_name ORDER BY profit DESC';
  return database.getAllAsync(query, params);
}

export async function getPnLByCard(from?: string, to?: string): Promise<{ card_name: string; set_name: string; revenue: number; cost: number; profit: number; count: number }[]> {
  const database = await getDatabase();
  let query = `SELECT
       card_name,
       set_name,
       COALESCE(SUM(sale_price * quantity), 0) as revenue,
       COALESCE(SUM(cost_basis * quantity), 0) as cost,
       COALESCE(SUM(profit), 0) as profit,
       COUNT(*) as count
     FROM sales WHERE 1=1`;
  const params: string[] = [];
  if (from) { query += ' AND sale_date >= ?'; params.push(from); }
  if (to) { query += ' AND sale_date <= ?'; params.push(to); }
  query += ' GROUP BY card_name, set_name ORDER BY profit DESC LIMIT 20';
  return database.getAllAsync(query, params);
}

// ---- End of Day Reports ----

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

export async function generateEndOfDayReport(dateStr?: string): Promise<EndOfDayReport> {
  const database = await getDatabase();
  const reportDate = dateStr || new Date().toISOString().slice(0, 10);

  // Get sales for the date
  const salesRow = await database.getFirstAsync<{ total: number; count: number; total_qty: number }>(
    `SELECT
       COALESCE(SUM(sale_price * quantity), 0) as total,
       COUNT(*) as count,
       COALESCE(SUM(quantity), 0) as total_qty
     FROM sales WHERE sale_date = ?`,
    [reportDate]
  );

  // Get purchases (cards added) for the date
  const purchRow = await database.getFirstAsync<{ total: number; count: number }>(
    `SELECT
       COALESCE(SUM(price_paid * quantity), 0) as total,
       COUNT(*) as count
     FROM cards WHERE date(created_at) = ?`,
    [reportDate]
  );

  const totalSales = salesRow?.total ?? 0;
  const totalPurchases = purchRow?.total ?? 0;
  const profit = totalSales - totalPurchases;

  // Upsert end_of_day_report
  const existing = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM end_of_day_reports WHERE report_date = ?',
    [reportDate]
  );

  if (existing) {
    await database.runAsync(
      `UPDATE end_of_day_reports
       SET total_sales = ?, total_sales_count = ?, total_purchases = ?, total_purchases_count = ?, gross_profit = ?, created_at = datetime('now')
       WHERE id = ?`,
      [totalSales, salesRow?.count ?? 0, totalPurchases, purchRow?.count ?? 0, profit, existing.id]
    );
    return getEndOfDayReport(reportDate) as Promise<EndOfDayReport>;
  } else {
    await database.runAsync(
      `INSERT INTO end_of_day_reports (report_date, total_sales, total_sales_count, total_purchases, total_purchases_count, gross_profit)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [reportDate, totalSales, salesRow?.count ?? 0, totalPurchases, purchRow?.count ?? 0, profit]
    );
  }

  return getEndOfDayReport(reportDate) as Promise<EndOfDayReport>;
}

export async function getEndOfDayReport(dateStr: string): Promise<EndOfDayReport | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<EndOfDayReport>(
    'SELECT * FROM end_of_day_reports WHERE report_date = ?',
    [dateStr]
  );
  return row ?? null;
}

export async function getEndOfDayReportHistory(limit: number = 30): Promise<EndOfDayReport[]> {
  const database = await getDatabase();
  return database.getAllAsync<EndOfDayReport>(
    'SELECT * FROM end_of_day_reports ORDER BY report_date DESC LIMIT ?',
    [limit]
  );
}

export async function getSalesForDate(dateStr: string): Promise<Sale[]> {
  const database = await getDatabase();
  return database.getAllAsync<Sale>(
    'SELECT * FROM sales WHERE sale_date = ? ORDER BY created_at DESC',
    [dateStr]
  );
}

// ---- Seed Data (for demo) ----

export async function seedIfEmpty(): Promise<void> {
  const database = await getDatabase();
  
  // If user has intentionally cleared data, don't re-seed
  const cleared = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'cleared'"
  );
  if (cleared?.value === '1') return;
  
  const count = await getCardCount();
  if (count > 0) return;

  const sampleTargets: Record<string, number> = {
    Charizard: 500, Blastoise: 130, Venusaur: 95, Pikachu: 18,
    Mewtwo: 180, Jolteon: 70, Vaporeon: 65, Flareon: 55,
    Gengar: 85, Dragonite: 110, Lugia: 300, Typhlosion: 140,
  };
  const seeds: CardInsert[] = [
    { name: 'Charizard', set_name: 'Base Set', card_number: '4/102', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 350.00, price_target: 500, quantity: 1, description: 'The iconic fire-breathing dragon from Base Set' },
    { name: 'Blastoise', set_name: 'Base Set', card_number: '2/102', rarity: 'Holo Rare', condition: 'Good', price_paid: 85.00, price_target: 130, quantity: 1, description: 'Powerful water-type tank' },
    { name: 'Venusaur', set_name: 'Base Set', card_number: '15/102', rarity: 'Holo Rare', condition: 'Light Played', price_paid: 60.00, price_target: 95, quantity: 1, description: 'Grass-type powerhouse' },
    { name: 'Pikachu', set_name: 'Base Set', card_number: '58/102', rarity: 'Common', condition: 'Mint', price_paid: 12.00, price_target: 18, quantity: 4, description: 'Fan-favorite electric mouse' },
    { name: 'Mewtwo', set_name: 'Base Set', card_number: '10/102', rarity: 'Holo Rare', condition: 'Excellent', price_paid: 120.00, price_target: 180, quantity: 1, description: 'Legendary psychic powerhouse' },
    { name: 'Jolteon', set_name: 'Jungle', card_number: '4/64', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 45.00, price_target: 70, quantity: 1, description: 'Lightning-fast electric Eeveelution' },
    { name: 'Vaporeon', set_name: 'Jungle', card_number: '12/64', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 40.00, price_target: 65, quantity: 1, description: 'Graceful water Eeveelution' },
    { name: 'Flareon', set_name: 'Jungle', card_number: '3/64', rarity: 'Holo Rare', condition: 'Good', price_paid: 35.00, price_target: 55, quantity: 1, description: 'Fiery Eeveelution' },
    { name: 'Gengar', set_name: 'Fossil', card_number: '5/62', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 55.00, price_target: 85, quantity: 1, description: 'Spooky ghost-type from Fossil' },
    { name: 'Dragonite', set_name: 'Fossil', card_number: '4/62', rarity: 'Holo Rare', condition: 'Excellent', price_paid: 70.00, price_target: 110, quantity: 1, description: 'Gentle dragon powerhouse' },
    { name: 'Lugia', set_name: 'Neo Genesis', card_number: '9/111', rarity: 'Holo Rare', condition: 'Near Mint', price_paid: 200.00, price_target: 300, quantity: 1, description: 'Legendary guardian of the seas' },
    { name: 'Typhlosion', set_name: 'Neo Genesis', card_number: '18/111', rarity: 'Holo Rare', condition: 'Mint', price_paid: 90.00, price_target: 140, quantity: 1, description: 'Volcanic fire-type from Neo Genesis' },
  ];

  for (const card of seeds) {
    const seedParams: (string | number | null)[] = [
      card.name, card.set_name, card.card_number ?? null, card.rarity ?? null,
      card.condition ?? 'Near Mint', card.price_paid, card.price_target ?? 0, card.price_sold ?? 0, card.quantity ?? 1,
      card.description ?? null,
    ];
    await database.runAsync(
      `INSERT INTO cards (name, set_name, card_number, rarity, condition, price_paid, price_target, price_sold, quantity, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      seedParams as any
    );
  }
}
