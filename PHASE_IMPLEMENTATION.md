# TradeSphere-Protocol — Phase 1 & 2 Implementation Roadmap

Full implementation is divided into **5 parts**, each independently deliverable.

---

## Part 1 — Marketplace Enhancements (Schema + Backend)

### Goal
Add the missing fields to support structured trade requests and exporter offers.

### Changes

#### `backend/schema.prisma`
- Add `qualityStandards String?` to `Trade` model *(Importer field)*
- Add `shippingTimeline String?` to `MarketplaceOffer` model *(Exporter field)*
- Add `termsAndConditions String?` to `MarketplaceOffer` model *(Exporter field)*
- Add new `TradeEvent` model for immutable audit trail:
  ```
  id, tradeId, actorId, actorRole, event, txHash, ipfsHash, createdAt
  ```
- Run `npx prisma migrate dev`

#### `backend/src/routes/marketplaceRoutes.ts`
- `GET /marketplace/offers/:tradeId` — list all offers for a trade (for importer comparison view)
- `POST /marketplace/offers/:offerId/decline` — importer declines an offer

#### `backend/src/controllers/marketplaceController.ts`
- Update `submitOffer` to accept & save `shippingTimeline` and `termsAndConditions`
- Add `getOffersForTrade` handler
- Add `declineOffer` handler

---

## Part 2 — Marketplace Frontend (Importer & Exporter UI)

### Goal
Build the UI so importers can publish structured requests and exporters can submit complete offers; importers compare and choose.

### Changes

#### `frontend/src/pages/importer/CreateTradeRequest.tsx`
- Add **Quality Standards** input field (e.g. "ISO 9001, Grade A")

#### `frontend/src/pages/exporter/SubmitOffer.tsx`
- Rename existing amount field label → **"Price Quotation (USD)"**
- Add **Shipping Timeline** text input (e.g. "12–15 business days")
- Replace combined `message` textarea → dedicated **Terms & Conditions** textarea

#### `frontend/src/pages/importer/OfferComparison.tsx` *(New Page)*
- Route: `/dashboard/trades/:tradeId/offers`
- Fetches all offers for the trade (`GET /marketplace/offers/:tradeId`)
- Side-by-side comparison table: Exporter Name | Price | Shipping Timeline | T&C | Status
- **Accept** button per row → calls `POST /marketplace/offers/:offerId/accept`
  - On accept: triggers blockchain `createTrade()` → trade state → `TRADE_INITIATED`
- **Decline** button per row → calls `POST /marketplace/offers/:offerId/decline`

#### `frontend/src/pages/importer/ImporterTrades.tsx`
- Add offer count badge on trades with `OPEN_FOR_OFFERS` status
- Clicking such a trade navigates to `OfferComparison` page

---

## Part 3 — Smart Contract Upgrade

### Goal
Extend contracts to cover the full trade lifecycle with all state transitions and IPFS hash storage.

### Changes

#### `contracts/TradeRegistry.sol`
Add statuses to `TradeStatus` enum:
```
MARKETPLACE_OPEN, OFFER_ACCEPTED, TRADE_INITIATED,
LOC_INITIATED, LOC_UPLOADED, LOC_APPROVED, FUNDS_LOCKED,
GOODS_SHIPPED, CUSTOMS_CLEARED, DUTY_PENDING, DUTY_PAID,
PAYMENT_AUTHORIZED, SETTLEMENT_CONFIRMED, COMPLETED
```
Add `shipping` address to `Trade` struct.

#### `contracts/LetterOfCredit.sol`
- `uploadLocDocument(uint256 tradeId, string ipfsHash)` — Importer Bank → `LOC_UPLOADED`
- `approveLoC(uint256 tradeId)` — Exporter Bank → `LOC_APPROVED`
- `lockFunds(uint256 tradeId)` — Importer Bank → `FUNDS_LOCKED`

#### `contracts/DocumentVerification.sol`
- `issueBillOfLading(uint256 tradeId, string ipfsHash)` — Shipping Co → `GOODS_SHIPPED`
- `verifyAsCustoms(uint256 tradeId, bool cleared)` — Customs → `CUSTOMS_CLEARED` or `DUTY_PENDING`
- `recordDutyPayment(uint256 tradeId)` — Tax Authority → `DUTY_PAID`

#### `contracts/PaymentSettlement.sol`
- `authorizePayment(uint256 tradeId)` — Importer Bank → `PAYMENT_AUTHORIZED`
- `confirmSettlement(uint256 tradeId)` — Exporter Bank → `SETTLEMENT_CONFIRMED` / `COMPLETED`

#### After contract changes:
- `npx hardhat compile`
- `node extract_abis.cjs` (regenerate ABIs)
- Redeploy to local Hardhat network

---

## Part 4 — IPFS Integration + Backend State Machine

### Goal
Wire document uploads to IPFS, store hashes on-chain, and expose a clean state-transition API for all stakeholders.

### Changes

#### `backend/src/services/IpfsService.ts` *(New)*
- Uses Pinata SDK
- `uploadFile(buffer, filename) → ipfsHash`
- `getUrl(ipfsHash) → string` (Pinata gateway URL)

#### `backend/src/routes/documentRoutes.ts` *(New)*
```
POST /documents/upload          → multer + role guard → IpfsService → on-chain hash → TradeEvent
GET  /documents/:tradeId/:type  → read ipfsHash from TradeEvent → return gateway URL
```

#### `backend/src/routes/tradeRoutes.ts`
```
PATCH /trades/:id/state    → role-guarded state transition (updates DB + fires contract call)
GET   /trades/:id/events   → returns all TradeEvent rows sorted by createdAt
```

#### `backend/src/services/EventListenerService.ts`
- Listen to all new contract events (LoCUploaded, BolIssued, CustomsCleared, etc.)
- Write a `TradeEvent` row per event (stores `txHash` + `ipfsHash`)

---

## Part 5 — Stakeholder Dashboards + Trade Timeline UI

### Goal
Wire all stakeholder dashboards with live data and real blockchain actions. Add universal timeline component for full transparency.

### Changes

#### `frontend/src/components/TradeTimeline.tsx` *(New)*
- Reusable vertical timeline: Actor | Event | Timestamp | Tx Hash badge | IPFS document link
- Used across all stakeholder pages

#### `frontend/src/pages/importer/TradeDetails.tsx`
- `TRADE_INITIATED` → Select Importer Bank dropdown → state `LOC_INITIATED`
- `FUNDS_LOCKED` → Select Shipping Company dropdown → state `GOODS_SHIPPED`
- `DUTY_PENDING` → Show duty amount + **Pay Duty** button → state `DUTY_PAID`
- Show `TradeTimeline` at bottom

#### `frontend/src/pages/bank/ImporterBankDashboard.tsx`
- List trades where `importerBankId = me`
- `LOC_INITIATED` → **Upload LoC Document** (IPFS) → state `LOC_UPLOADED`
- `LOC_APPROVED` → **Lock Funds** (on-chain) → state `FUNDS_LOCKED`
- `CUSTOMS_CLEARED` → **Authorize Payment** (on-chain) → state `PAYMENT_AUTHORIZED`

#### `frontend/src/pages/bank/ExporterBankDashboard.tsx`
- List trades where `exporterBankId = me`
- `LOC_UPLOADED` → View LoC doc (IPFS) → **Approve LoC** → state `LOC_APPROVED`
- `PAYMENT_AUTHORIZED` → **Confirm Settlement** → state `COMPLETED`

#### `frontend/src/pages/stakeholders/ShippingDashboard.tsx`
- `FUNDS_LOCKED` → **Accept Goods** + **Upload BoL** (IPFS) → state `GOODS_SHIPPED`
- **Reject Goods** option

#### `frontend/src/pages/stakeholders/CustomsDashboard.tsx`
- `GOODS_SHIPPED` → View BoL → **Mark Cleared** → `CUSTOMS_CLEARED`
- **Mark Not Cleared** → `DUTY_PENDING`

#### `frontend/src/pages/stakeholders/TaxDashboard.tsx`
- `DUTY_PENDING` → Input duty amount → **Notify Importer**
- On `DUTY_PAID` → **Release Goods** → `CUSTOMS_CLEARED`

#### `frontend/src/pages/stakeholders/RegulatorDashboard.tsx`
- All trades table with current state
- Per trade: full `TradeTimeline` (every event, tx hash, IPFS doc links)
- Acts as admin — full read-only visibility across all stakeholders

---

## Implementation Order

| Part | Description | Depends On |
|------|-------------|------------|
| 1 | Schema + Backend Marketplace | — |
| 2 | Marketplace Frontend | Part 1 |
| 3 | Smart Contract Upgrade | — |
| 4 | IPFS + Backend State Machine | Parts 1, 3 |
| 5 | Stakeholder Dashboards + Timeline | Parts 1, 3, 4 |

> **Note:** Parts 1 & 3 can be done in parallel. Parts 2 & 4 each depend on their respective predecessor. Part 5 is the final integration layer.
