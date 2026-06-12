// DataMatrix label generator for NK_P21 printer (74mm × 124mm labels)
// Uses bwip-js to generate a DataMatrix code in the browser

// @ts-nocheck
import bwipjs from 'bwip-js';
import { Card } from '../database';

export interface LabelData {
  id: number;
  name: string;
  set_name: string;
  card_number?: string;
}

/**
 * Encode card data into a DataMatrix-friendly JSON string.
 * This is the same format our scanner expects:
 *   {"name":"Charizard","set_name":"Base Set","card_number":"4/102","id":1}
 */
export function encodeCardForLabel(card: LabelData): string {
  return JSON.stringify({
    name: card.name,
    set_name: card.set_name,
    card_number: card.card_number || '',
    id: card.id,
  });
}

/**
 * Generate a DataMatrix barcode as a PNG data URL.
 * Size optimized for 74×124mm label printer.
 */
export async function generateDataMatrixPng(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Render to canvas, then export as PNG
      const canvas = document.createElement('canvas');
      bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix',      // Barcode type
        text: data,              // Data to encode
        scale: 3,                // 3x scaling for print quality
        height: 20,              // Module height (mm equivalent)
        width: 20,               // Module width
        includetext: false,      // Don't include text in the barcode
        textxalign: 'center',
      });
      resolve(canvas.toDataURL('image/png'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate an SVG DataMatrix barcode for high-quality printing.
 */
export async function generateDataMatrixSvg(data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const svg = bwipjs.toSVG({
        bcid: 'datamatrix',
        text: data,
        scale: 3,
        height: 20,
        width: 20,
        includetext: false,
      });
      resolve(svg);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Open the browser print dialog with a formatted label layout
 * matching the NK_P21 74×124mm label size.
 */
export function printLabel(
  card: Card,
  dataMatrixPng: string
): void {
  const encodedData = encodeCardForLabel(card);

  const printWindow = window.open('', '_blank', 'width=600,height=800');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Print Label — ${card.name}</title>
      <style>
        @page {
          size: 74mm 124mm;
          margin: 0;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          width: 74mm;
          height: 124mm;
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background: white;
          color: #111;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6mm;
          gap: 3mm;
        }
        .label-header {
          text-align: center;
          width: 100%;
        }
        .card-name {
          font-size: 10pt;
          font-weight: 800;
          line-height: 1.2;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .card-set {
          font-size: 7pt;
          color: #555;
          margin-top: 1mm;
        }
        .card-number {
          font-size: 6pt;
          color: #888;
        }
        .barcode-container {
          width: 56mm;
          height: 56mm;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 0.5pt solid #ddd;
          border-radius: 2mm;
          padding: 2mm;
        }
        .barcode-container img {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }
        .label-footer {
          text-align: center;
          font-size: 5pt;
          color: #aaa;
          width: 100%;
        }
        .id-text {
          font-size: 5pt;
          color: #999;
          font-family: monospace;
        }
        .price {
          font-size: 8pt;
          font-weight: 700;
          color: #00a884;
          margin-top: 1mm;
        }
        .condition {
          font-size: 6pt;
          color: #666;
          padding: 0.5mm 2mm;
          border: 0.3pt solid #ccc;
          border-radius: 1mm;
        }
      </style>
    </head>
    <body>
      <div class="label-header">
        <div class="card-name">${escapeHtml(card.name)}</div>
        <div class="card-set">${escapeHtml(card.set_name)}</div>
        ${card.card_number ? `<div class="card-number">#${escapeHtml(card.card_number)}</div>` : ''}
        ${card.rarity ? `<div class="card-number" style="font-weight:600;color:#555;">${escapeHtml(card.rarity)}</div>` : ''}
      </div>

      <div class="barcode-container">
        <img src="${dataMatrixPng}" alt="DataMatrix" />
      </div>

      <div style="display:flex;align-items:center;gap:2mm;">
        <span class="condition">${escapeHtml(card.condition)}</span>
        <span class="price">$${card.price_paid.toFixed(2)}</span>
      </div>

      <div class="label-footer">
        <div class="id-text">ID: ${card.id} · TCG Terminal</div>
      </div>

      <script>
        // Auto-trigger print and close
        window.onload = function() {
          setTimeout(function() {
            window.print();
            // Don't auto-close — let user decide
          }, 500);
        };
      </script>
    </body>
    </html>
  `);

  printWindow.document.close();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
