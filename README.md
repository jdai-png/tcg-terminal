# TCG Terminal

**TCG Terminal** — scan, manage, buy & sell trading cards with your phone.

A cross-platform inventory management app for TCG collectors and resellers. Scan barcodes, DataMatrix codes, and QR labels to look up cards; track your collection, cost basis, and profit/loss; import and export CSV files; and generate end-of-day reports.

Built with [Expo](https://expo.dev) + React Native, with full web support via localStorage persistence.

---

## Features

- **📱 Scanner** — scan barcodes, DataMatrix, and QR codes to instantly look up or register cards
- **📦 Inventory** — full CRUD with rich fields: name, set, card number, rarity, condition, price paid, price target, tags, notes, and photos
- **💰 Sales & P&L** — record sales linked to inventory, auto-decrement quantity, track profit/loss by card, set, or date range
- **📊 Dashboard** — investment breakdown by set, recent activity, P&L summaries, and end-of-day reports
- **📥 CSV Import/Export** — bulk import with upsert (match by DataMatrix or ID), export full inventory, CSV template download
- **🏷️ Label Printing** — print barcode labels via bwip-js
- **📤 Share Inventory** — share inventory snapshots via the OS share sheet
- **🎨 Pokedex-inspired UI** — dark theme with neon accents, tab-based navigation
- **🌐 Cross-platform** — runs on iOS, Android, and web

---

## Quick Start

```bash
# Install dependencies
npm install

# Start the dev server
npx expo start
```

- Press `i` for iOS simulator, `a` for Android emulator, or `w` for web
- Scan the QR code with Expo Go to run on your physical device

---

## Project Structure

```
tcg-terminal/
├── app/                  # Expo Router screens & layout
│   ├── _layout.tsx       # Root layout (tabs)
│   ├── index.tsx         # Dashboard
│   ├── inventory/        # Inventory list & detail
│   ├── scanner.tsx       # Barcode / DataMatrix scanner
│   ├── sales/            # Sales history & P&L
│   ├── logistics.tsx     # Import/export & reports
│   ├── register.tsx      # Register new card
│   └── settings.tsx      # App settings
├── components/           # Reusable UI components
├── database/             # Database layer (localStorage on web, SQLite on native)
├── utils/                # Helpers (CSV, formatting, label printer, theme, sounds)
├── docs/                 # Documentation
│   └── prd/              # Product requirement documents
├── assets/               # Static assets (icons, sounds)
└── public/               # Web static files
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo SDK 56 + React Native 0.85 |
| Routing | Expo Router (file-based) |
| Language | TypeScript 6 |
| UI | React Native + custom Pokédex theme |
| Database (native) | expo-sqlite |
| Database (web) | localStorage (persisted) |
| Scanner | expo-camera (barcode/QR) |
| CSV | PapaParse |
| Labels | bwip-js |
| Animations | react-native-reanimated |

---

## Documentation

Product requirement documents are available in [`docs/prd/`](docs/prd/):

- [CSV Import/Export Enhancement](docs/prd/PRD_CSV_IMPORT_EXPORT_ENHANCEMENT.md)
- [Database Refactor](docs/prd/PRD_DATABASE_REFACTOR.md)
- [DataMatrix First Scanning](docs/prd/PRD_DATAMATRIX_FIRST_SCANNING.md)
- [Enhanced Features v2](docs/prd/PRD_ENHANCED_FEATURES_V2.md)
- [Scanner Optimization](docs/prd/PRD_SCANNER_OPTIMIZATION.md)

---

## License

MIT
