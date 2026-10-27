# Splitwise Master Project (Antigravity IDE Ready)

A complete, modular engineering clone of **Splitwise** built from `docs/SPECIFICATION_AND_UI_UX_TEARDOWN.md`. It implements an ACID double-entry expense ledger, all 5 split computation strategies with deterministic penny allocation, multi-payer support, itemized receipt OCR splitting, UPI deep-link (`upi://pay`) + QR code settlement, and the Greedy Min-Cash-Flow debt simplification engine.

## Repository Structure

```text
splitwise-master/
├── .antigravity/
│   └── workspace.json                      # Google Antigravity IDE workspace configuration
├── docs/
│   └── SPECIFICATION_AND_UI_UX_TEARDOWN.md # Full architectural, algorithmic & UI/UX specification
├── database/
│   └── schema.sql                          # Relational ACID DDL (users, groups, expenses, revisions)
├── src/
│   ├── types/
│   │   └── ledger.ts                       # Core TypeScript data models & double-entry contracts
│   ├── engine/
│   │   ├── splitCalculator.ts              # Equal, Exact, Percent, Shares, Adjustment + Penny Allocation
│   │   ├── debtSimplifier.ts               # Greedy Min-Cash-Flow DAG solver (at most N-1 transfers)
│   │   └── fxConverter.ts                  # Multi-currency ISO 4217 converter & inline calculator parser
│   ├── server/
│   │   └── api.ts                          # Express REST API gateway with idempotency & audit logs
│   └── client/
│       └── App.tsx                         # Modular React + Tailwind UI component architecture
├── preview/
│   └── splitwise_app.html                  # Zero-build standalone full interactive web application
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Quick Start in Google Antigravity IDE

1. Extract `splitwise_master_project.zip` and open the `splitwise-master` folder in **Google Antigravity IDE** (or VS Code).
2. To run the standalone interactive build immediately with zero dependencies, open `preview/splitwise_app.html` in any browser or live-preview pane.
3. For the full TypeScript/React + Express workspace:
   ```bash
   npm install
   npm run dev
   ```
