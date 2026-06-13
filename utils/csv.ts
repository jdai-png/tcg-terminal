// CSV import/export utilities for TCG Terminal
import Papa from 'papaparse';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CardInsert, insertCard, getAllCards, deleteAllCards, deleteCardsNotInList, logOperation, upsertCard } from '../database';

// ---- CSV Template / Export ----

export const CSV_HEADERS = [
  'id',
  'name',
  'set_name',
  'card_number',
  'rarity',
  'condition',
  'price_paid',
  'price_target',
  'price_sold',
  'quantity',
  'purchase_date',
  'data_matrix',
  'tags',
  'notes',
  'description',
  'archived',
];

export function generateCsvTemplate(): string {
  const sampleRows = [
    {
      id: '',
      name: 'Charizard',
      set_name: 'Base Set',
      card_number: '4/102',
      rarity: 'Holo Rare',
      condition: 'Near Mint',
      price_paid: '350.00',
      price_target: '500.00',
      price_sold: '',
      quantity: '1',
      purchase_date: '2024-01-15',
      data_matrix: '01073002362572271054256624020260342205021140610659072',
      tags: 'chase,graded',
      notes: 'PSA 9',
      description: 'The iconic fire-breathing dragon from Base Set',
      archived: '',
    },
    {
      id: '',
      name: 'Pikachu',
      set_name: 'Base Set',
      card_number: '58/102',
      rarity: 'Common',
      condition: 'Mint',
      price_paid: '12.00',
      price_target: '20.00',
      price_sold: '',
      quantity: '4',
      purchase_date: '2024-02-20',
      data_matrix: '',
      tags: '',
      notes: '',
      description: 'Fan-favorite electric mouse Pokémon',
      archived: '',
    },
  ];
  return Papa.unparse({ fields: CSV_HEADERS, data: sampleRows });
}

export async function exportCardsToCsv(): Promise<string> {
  const csv = await getExportCsvContent();
  const fileName = `tcg_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const filePath = `${FileSystem.documentDirectory}${fileName}`;

  await FileSystem.writeAsStringAsync(filePath, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
}

/** Generate CSV content string only (no filesystem write) — useful for web blob downloads */
export async function getExportCsvContent(): Promise<string> {
  const cards = await getAllCards();
  const data = cards.map(c => ({
    id: c.id.toString(),
    name: c.name,
    set_name: c.set_name,
    card_number: c.card_number ?? '',
    rarity: c.rarity ?? '',
    condition: c.condition,
    price_paid: c.price_paid.toFixed(2),
    price_target: (c.price_target ?? 0).toFixed(2),
    price_sold: (c.price_sold ?? 0).toFixed(2),
    quantity: c.quantity.toString(),
    purchase_date: c.purchase_date ?? '',
    data_matrix: c.data_matrix ?? '',
    tags: c.tags ?? '',
    notes: c.notes ?? '',
    description: c.description ?? '',
    archived: c.archived ? '1' : '',
  }));
  return Papa.unparse({ fields: CSV_HEADERS, data });
}

export async function shareCsvFile(filePath: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(filePath, {
    mimeType: 'text/csv',
    dialogTitle: 'Export TCG Inventory',
  });
}

// ---- CSV Import (Upsert) ----

export interface ImportResult {
  added: number;
  updated: number;
  removed: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Parse a CSV string and import cards using upsert logic:
 * - If 'id' column has a value > 0 → update that card
 * - Else if 'data_matrix' matches an existing card → update that card
 * - Otherwise → insert as new card
 *
 * @param syncMode - If true, after import, delete any cards whose ID was NOT present in the CSV
 */
export async function importCsvContent(
  csvContent: string,
  fileName: string,
  replaceExisting: boolean = false,
  syncMode: boolean = false
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, removed: 0, skipped: 0, failed: 0, errors: [] };

  return new Promise((resolve) => {
    Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (parseResult) => {
        if (parseResult.errors && parseResult.errors.length > 0) {
          result.errors.push(
            ...parseResult.errors.map(e => `Row ${e.row}: ${e.message}`)
          );
        }

        if (!parseResult.data || parseResult.data.length === 0) {
          result.errors.push('No data found in CSV');
          await logOperation('import', 'failure', 0, fileName, 'No data found');
          resolve(result);
          return;
        }

        // Filter out completely blank rows (all fields falsy)
        const rows: any[] = parseResult.data.filter((row: any) => {
          const values = Object.values(row);
          return values.some(v => v !== '' && v !== null && v !== undefined);
        });

        if (rows.length === 0) {
          result.errors.push('No data rows found in CSV (only headers or blank rows)');
          await logOperation('import', 'failure', 0, fileName, 'No data rows');
          resolve(result);
          return;
        }

        try {
          if (replaceExisting) {
            await deleteAllCards();
          }

          // Track which IDs are present in the CSV (for sync mode)
          const csvIds: number[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            // Parse fields used by both try and catch
            let rowName = '';
            let rowSet = '';
            try {
              // Parse the id field
              const rawId = row.id ? parseInt(String(row.id).trim(), 10) : 0;
              const hasId = !isNaN(rawId) && rawId > 0;

              // Parse data_matrix
              const dm = row.data_matrix ? String(row.data_matrix).trim() : undefined;
              const hasDataMatrix = dm && dm.length > 0;

              // Parse numeric fields
              const pricePaidVal = parseFloat(row.price_paid);
              const priceTargetVal = row.price_target ? parseFloat(row.price_target) : undefined;
              const priceSoldVal = row.price_sold ? parseFloat(row.price_sold) : undefined;
              const quantityVal = parseInt(row.quantity, 10);

              // Required fields validation
              const name = String(row.name || '').trim();
              const set_name = String(row.set_name || '').trim();
              rowName = name;
              rowSet = set_name;
              if (!name || !set_name) {
                result.failed++;
                const idHint = hasId ? ` (id: ${rawId})` : '';
                const nameHint = name ? `name="${name}"` : 'name missing';
                const setHint = set_name ? `set="${set_name}"` : 'set_name missing';
                result.errors.push(`Row ${i + 2}${idHint}: ${nameHint}, ${setHint}`);
                continue;
              }

              // Build card insert object
              const card: CardInsert & { id?: number } = {
                name,
                set_name,
                price_paid: !isNaN(pricePaidVal) ? pricePaidVal : 0,
                quantity: !isNaN(quantityVal) && quantityVal > 0 ? quantityVal : 1,
              };

              // ID
              if (hasId) card.id = rawId;

              // Optional fields — only set if the CSV column has a value
              if (row.card_number !== undefined && String(row.card_number).trim()) card.card_number = String(row.card_number).trim();
              if (row.rarity !== undefined && String(row.rarity).trim()) card.rarity = String(row.rarity).trim();
              if (row.condition !== undefined && String(row.condition).trim()) card.condition = String(row.condition).trim();
              else card.condition = 'Near Mint';
              if (priceTargetVal !== undefined && !isNaN(priceTargetVal)) card.price_target = priceTargetVal;
              if (priceSoldVal !== undefined && !isNaN(priceSoldVal)) card.price_sold = priceSoldVal;
              if (row.purchase_date && String(row.purchase_date).trim()) card.purchase_date = String(row.purchase_date).trim();
              if (hasDataMatrix) card.data_matrix = dm;

              // Auto-detect DataMatrix-like names: if name is purely numeric and >= 20 chars,
              // move it to data_matrix instead (fixes exports from before the scanner fix)
              if (!hasDataMatrix && card.name && /^\d{20,}$/.test(card.name)) {
                card.data_matrix = card.name;
                card.name = '';
              }
              if (row.tags !== undefined && String(row.tags).trim()) card.tags = String(row.tags).trim();
              if (row.notes !== undefined && String(row.notes).trim()) card.notes = String(row.notes).trim();
              if (row.description !== undefined && String(row.description).trim()) card.description = String(row.description).trim();

              // Upsert logic: try update first, then insert
              const upsertResult = await upsertCard(card);
              if (upsertResult.action === 'updated') {
                result.updated++;
              } else {
                result.added++;
              }
              // Track the card's ID for sync mode
              csvIds.push(upsertResult.id);
            } catch (err: any) {
              result.failed++;
              const ctx = rowName && rowSet ? `"${rowName}" / ${rowSet}` : `row ${i + 2}`;
              result.errors.push(`Row ${i + 2} (${ctx}): ${err.message}`);
            }
          }

          // Sync mode: remove cards not in the CSV
          if (syncMode) {
            result.removed = await deleteCardsNotInList(csvIds);
          }

          const totalSuccess = result.added + result.updated;
          const hasErrors = result.errors.length > 0 || result.failed > 0;
          // Store full error details in the operation log (as JSON)
          const errorDetail = hasErrors ? JSON.stringify({ failed: result.failed, errors: result.errors.slice(0, 20) }) : undefined;
          await logOperation(
            'import',
            hasErrors ? 'failure' : 'success',
            totalSuccess,
            fileName,
            errorDetail
          );
        } catch (err: any) {
          result.errors.push(`Fatal import error: ${err.message}`);
          await logOperation('import', 'failure', result.added + result.updated, fileName, err.message);
        }

        resolve(result);
      },
      error: async (err: Error) => {
        result.errors.push(`Parse error: ${err.message}`);
        await logOperation('import', 'failure', 0, fileName, err.message);
        resolve(result);
      },
    });
  });
}
