# TradeSphere-Protocol — Complete Data Schema

All entities, attributes, types, and purposes based on the Phase 1 & Phase 2 flow.

---

## Enums

### `Role`
| Value | Description |
|-------|-------------|
| `IMPORTER` | Creates trade requests, selects bank & shipping, pays duty |
| `EXPORTER` | Submits offers, ships goods |
| `IMPORTER_BANK` | Issues LoC, locks funds, authorizes payment |
| `EXPORTER_BANK` | Approves LoC, confirms payment settlement |
| `SHIPPING` | Accepts/rejects goods, uploads Bill of Lading |
| `CUSTOMS` | Verifies goods, clears or flags for duty |
| `TAX_AUTHORITY` | Calculates & collects duty when customs not cleared |
| `REGULATORS` | Read-only admin; sees all trades, timelines, tx hashes |
| `INSURANCE` | (Reserved for future insurance flows) |

---

### `TradeStatus`
| Value | Triggered By | Description |
|-------|-------------|-------------|
| `OPEN_FOR_OFFERS` | Importer (create request) | Trade posted to marketplace |
| `OFFER_ACCEPTED` | Importer (accepts offer) | One exporter offer selected |
| `TRADE_INITIATED` | Both parties confirm on-chain | Blockchain trade created |
| `LOC_INITIATED` | Importer (selects bank) | LoC process started |
| `LOC_UPLOADED` | Importer Bank (uploads doc) | LoC document on IPFS + hash on-chain |
| `LOC_APPROVED` | Exporter Bank | Exporter bank reviewed & approved LoC |
| `FUNDS_LOCKED` | Importer Bank | Funds locked in smart contract escrow |
| `SHIPPING_ASSIGNED` | Importer (selects company) | Shipping company assigned to trade |
| `GOODS_SHIPPED` | Shipping Company (uploads BoL) | Bill of Lading issued, on IPFS |
| `CUSTOMS_UNDER_REVIEW` | System (on GOODS_SHIPPED) | Customs reviewing the goods |
| `CUSTOMS_CLEARED` | Customs Authority | Goods cleared; payment flow begins |
| `DUTY_PENDING` | Customs Authority (flagged) | Goods held; duty calculation required |
| `DUTY_PAID` | Importer (via Importer Bank) | Extra duty fee paid to tax authority |
| `PAYMENT_AUTHORIZED` | Importer Bank | Payment authorized on-chain |
| `SETTLEMENT_CONFIRMED` | Exporter Bank | Off-chain settlement confirmed |
| `COMPLETED` | System (on settlement confirmed) | Trade fully completed |
| `DISPUTED` | Any participant | Trade under dispute |
| `EXPIRED` | System | Trade expired without completion |

---

### `DocumentType`
| Value | Uploaded By | Description |
|-------|-------------|-------------|
| `LETTER_OF_CREDIT` | Importer Bank | LoC document |
| `BILL_OF_LADING` | Shipping Company | BoL document |
| `CUSTOMS_CERTIFICATE` | Customs Authority | Clearance certificate |
| `TAX_CLEARANCE` | Tax Authority | Duty payment receipt |
| `TRADE_AGREEMENT` | System | Final confirmed trade agreement |
| `INSURANCE_CERTIFICATE` | Insurance (future) | Insurance document |
| `OTHER` | Any | Miscellaneous supporting document |

---

### `OfferStatus`
| Value | Description |
|-------|-------------|
| `PENDING` | Awaiting importer review |
| `ACCEPTED` | Importer accepted this offer |
| `DECLINED` | Importer declined this offer |

---

### `DutyStatus`
| Value | Description |
|-------|-------------|
| `ASSESSED` | Tax authority has calculated duty |
| `NOTIFIED` | Importer has been notified |
| `PAID` | Importer has paid the duty |

---

### `LoCStatus`
| Value | Description |
|-------|-------------|
| `REQUESTED` | Importer initiated LoC request |
| `UPLOADED` | Importer bank uploaded document |
| `APPROVED` | Exporter bank approved |
| `FUNDS_LOCKED` | Funds locked in escrow |
| `EXPIRED` | LoC expired |

---

## Entities

### `User`
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `email` | `String` | ✅ | Unique login email |
| `password` | `String` | ✅ | Hashed password |
| `name` | `String` | ✅ | Full name / org name |
| `role` | `Role` (enum) | ✅ | System role |
| `walletAddress` | `String?` | ❌ | Ethereum wallet address for on-chain actions |
| `phone` | `String?` | ❌ | Contact number |
| `country` | `String?` | ❌ | Country of operation |
| `organizationName` | `String?` | ❌ | Legal entity / company name |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `Trade`
The central entity representing a full trade lifecycle.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `blockchainId` | `Int?` | ❌ | On-chain trade ID from `TradeRegistry` contract |
| `blockchainTxHash` | `String?` | ❌ | Tx hash when trade was created on-chain |
| `status` | `TradeStatus` (enum) | ✅ | Current state of the trade |
| **Importer fields** | | | |
| `importerId` | `String` | ✅ | FK → User (role: IMPORTER) |
| `productName` | `String` | ✅ | Product / goods description |
| `quantity` | `String` | ✅ | Quantity with unit (e.g. "500 MT") |
| `destination` | `String` | ✅ | Destination country |
| `priceRange` | `String?` | ❌ | Expected price range (e.g. "100000–120000 USD") |
| `shippingDeadline` | `DateTime?` | ❌ | Required by date |
| `insuranceRequired` | `Boolean` | ✅ | Whether insurance is required (default: false) |
| `qualityStandards` | `String?` | ❌ | Required standards (e.g. "ISO 9001, Grade A") |
| `additionalConditions` | `String?` | ❌ | Any extra compliance or document requirements |
| **Participants** | | | |
| `exporterId` | `String?` | ❌ | FK → User (role: EXPORTER); set on offer acceptance |
| `importerBankId` | `String?` | ❌ | FK → User (role: IMPORTER_BANK); set by importer |
| `exporterBankId` | `String?` | ❌ | FK → User (role: EXPORTER_BANK); set by exporter |
| `shippingId` | `String?` | ❌ | FK → User (role: SHIPPING); set by importer |
| `customsOfficerId` | `String?` | ❌ | FK → User (role: CUSTOMS) |
| `taxAuthorityId` | `String?` | ❌ | FK → User (role: TAX_AUTHORITY) |
| **Financials** | | | |
| `amount` | `Float` | ✅ | Agreed trade value (USD); set on offer acceptance |
| `dutyAmount` | `Float?` | ❌ | Extra duty/tariff assessed by tax authority |
| **Timestamps** | | | |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `MarketplaceOffer`
Exporter's response to an importer's trade request.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade |
| `exporterId` | `String` | ✅ | FK → User (role: EXPORTER) |
| `amount` | `Float` | ✅ | Price quotation (USD) — exporter's total quote |
| `shippingTimeline` | `String` | ✅ | Estimated delivery window (e.g. "12–15 business days") |
| `termsAndConditions` | `String` | ✅ | Exporter's T&C (separate from message) |
| `deliveryTerms` | `String` | ✅ | Incoterms: CIF, FOB, EXW, DDP, etc. |
| `message` | `String?` | ❌ | Optional additional note to importer |
| `validUntil` | `DateTime?` | ❌ | Offer expiry date |
| `status` | `OfferStatus` (enum) | ✅ | PENDING / ACCEPTED / DECLINED (default: PENDING) |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `LetterOfCredit`
Tracks the full LoC lifecycle between importer bank and exporter bank.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade (unique — one LoC per trade) |
| `importerBankId` | `String` | ✅ | FK → User (role: IMPORTER_BANK) |
| `exporterBankId` | `String?` | ❌ | FK → User (role: EXPORTER_BANK); set when exporter selects bank |
| `amount` | `Float` | ✅ | LoC value (same as trade amount) |
| `expiryDate` | `DateTime` | ✅ | LoC expiry date |
| `ipfsHash` | `String?` | ❌ | IPFS hash of uploaded LoC document |
| `documentTxHash` | `String?` | ❌ | Blockchain tx hash that stored the IPFS hash |
| `status` | `LoCStatus` (enum) | ✅ | Current LoC status |
| `uploadedAt` | `DateTime?` | ❌ | When importer bank uploaded the doc |
| `approvedAt` | `DateTime?` | ❌ | When exporter bank approved |
| `fundsLockedAt` | `DateTime?` | ❌ | When importer bank locked funds |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `BillOfLading`
Issued by the shipping company after accepting the goods.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade (unique — one BoL per trade) |
| `shippingCompanyId` | `String` | ✅ | FK → User (role: SHIPPING) |
| `bolNumber` | `String` | ✅ | Official Bill of Lading reference number |
| `vesselName` | `String?` | ❌ | Name of the vessel / carrier |
| `portOfLoading` | `String` | ✅ | Port where goods were loaded |
| `portOfDischarge` | `String` | ✅ | Destination port |
| `estimatedArrival` | `DateTime?` | ❌ | Estimated arrival date |
| `goodsAccepted` | `Boolean` | ✅ | Whether shipping company accepted the goods |
| `rejectionReason` | `String?` | ❌ | Reason if goods rejected |
| `ipfsHash` | `String?` | ❌ | IPFS hash of uploaded BoL document |
| `documentTxHash` | `String?` | ❌ | Blockchain tx hash that stored the IPFS hash |
| `issuedAt` | `DateTime?` | ❌ | When the BoL was officially issued |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `CustomsVerification`
Record of customs authority's review of a shipment.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade (unique per trade) |
| `customsOfficerId` | `String` | ✅ | FK → User (role: CUSTOMS) |
| `isCleared` | `Boolean?` | ❌ | True = cleared, False = held for duty, null = pending review |
| `remarks` | `String?` | ❌ | Notes from customs officer |
| `ipfsHash` | `String?` | ❌ | IPFS hash of clearance certificate (if issued) |
| `documentTxHash` | `String?` | ❌ | Blockchain tx hash |
| `verifiedAt` | `DateTime?` | ❌ | When verification decision was made |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `DutyAssessment`
Tax authority's duty/tariff calculation when goods are not customs-cleared.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade |
| `taxAuthorityId` | `String` | ✅ | FK → User (role: TAX_AUTHORITY) |
| `dutyAmount` | `Float` | ✅ | Calculated duty fee (USD) |
| `tariffRate` | `Float?` | ❌ | Tariff percentage applied |
| `taxType` | `String?` | ❌ | Type of tax (e.g. "Import Duty", "VAT", "GST") |
| `description` | `String?` | ❌ | Explanation of how duty was calculated |
| `status` | `DutyStatus` (enum) | ✅ | ASSESSED / NOTIFIED / PAID |
| `notifiedAt` | `DateTime?` | ❌ | When importer was notified |
| `paidAt` | `DateTime?` | ❌ | When importer paid the duty |
| `paymentTxHash` | `String?` | ❌ | Blockchain tx hash of duty payment |
| `createdAt` | `DateTime` | ✅ | Auto-set on creation |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `Document`
Generic document store for any uploaded file in the trade lifecycle.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade |
| `uploadedById` | `String` | ✅ | FK → User (who uploaded) |
| `uploadedByRole` | `Role` (enum) | ✅ | Role of uploader at time of upload |
| `type` | `DocumentType` (enum) | ✅ | Category of document |
| `fileName` | `String` | ✅ | Original file name |
| `fileSize` | `Int?` | ❌ | File size in bytes |
| `mimeType` | `String?` | ❌ | MIME type (e.g. "application/pdf") |
| `ipfsHash` | `String` | ✅ | IPFS content identifier (CID) |
| `ipfsGatewayUrl` | `String?` | ❌ | Public gateway URL for easy access |
| `blockchainTxHash` | `String?` | ❌ | Tx hash where this IPFS hash was stored on-chain |
| `createdAt` | `DateTime` | ✅ | Auto-set on upload |

---

### `TradeEvent`
Immutable audit log entry for every state change or action in the trade lifecycle.

| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `tradeId` | `String` | ✅ | FK → Trade |
| `actorId` | `String?` | ❌ | FK → User who triggered this event |
| `actorRole` | `String` | ✅ | Role at time of event |
| `event` | `String` | ✅ | Event name (e.g. "LOC_UPLOADED", "GOODS_SHIPPED") |
| `fromStatus` | `String?` | ❌ | Trade status before this event |
| `toStatus` | `String?` | ❌ | Trade status after this event |
| `txHash` | `String?` | ❌ | Blockchain transaction hash (for on-chain events) |
| `ipfsHash` | `String?` | ❌ | IPFS hash if a document was involved |
| `metadata` | `Json?` | ❌ | Any extra context (e.g. duty amount, port name) |
| `createdAt` | `DateTime` | ✅ | Auto-set; immutable timestamp |

---

### `MarketplaceListing` *(existing — unchanged)*
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `productId` | `String` | ✅ | FK → Product |
| `exporterId` | `String` | ✅ | FK → User (role: EXPORTER) |
| `price` | `Float` | ✅ | Listed price |
| `quantity` | `Int` | ✅ | Available quantity |
| `status` | `String` | ✅ | ACTIVE / INACTIVE (default: ACTIVE) |
| `createdAt` | `DateTime` | ✅ | Auto-set |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `Product` *(existing — unchanged)*
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `name` | `String` | ✅ | Product name |
| `description` | `String?` | ❌ | Description |
| `categoryId` | `String?` | ❌ | FK → Category |
| `createdAt` | `DateTime` | ✅ | Auto-set |
| `updatedAt` | `DateTime` | ✅ | Auto-updated |

---

### `Category` *(existing — unchanged)*
| Attribute | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `String` (UUID) | ✅ | Primary key |
| `name` | `String` | ✅ | Unique category name |

---

## Prisma Schema (Updated)

```prisma
// ─────────────────────────────────────────────────────────────
// TradeSphere-Protocol — Full Updated Prisma Schema
// Covers Phase 1 (Marketplace) + Phase 2 (Full Trade Lifecycle)
// ─────────────────────────────────────────────────────────────

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────

enum Role {
  IMPORTER
  EXPORTER
  IMPORTER_BANK
  EXPORTER_BANK
  SHIPPING
  CUSTOMS
  TAX_AUTHORITY
  REGULATORS
  INSURANCE
}

enum TradeStatus {
  OPEN_FOR_OFFERS
  OFFER_ACCEPTED
  TRADE_INITIATED
  LOC_INITIATED
  LOC_UPLOADED
  LOC_APPROVED
  FUNDS_LOCKED
  SHIPPING_ASSIGNED
  GOODS_SHIPPED
  CUSTOMS_UNDER_REVIEW
  CUSTOMS_CLEARED
  DUTY_PENDING
  DUTY_PAID
  PAYMENT_AUTHORIZED
  SETTLEMENT_CONFIRMED
  COMPLETED
  DISPUTED
  EXPIRED
}

enum OfferStatus {
  PENDING
  ACCEPTED
  DECLINED
}

enum LoCStatus {
  REQUESTED
  UPLOADED
  APPROVED
  FUNDS_LOCKED
  EXPIRED
}

enum DutyStatus {
  ASSESSED
  NOTIFIED
  PAID
}

enum DocumentType {
  LETTER_OF_CREDIT
  BILL_OF_LADING
  CUSTOMS_CERTIFICATE
  TAX_CLEARANCE
  TRADE_AGREEMENT
  INSURANCE_CERTIFICATE
  OTHER
}

// ─── User ─────────────────────────────────────────────────────

model User {
  id               String   @id @default(uuid())
  email            String   @unique
  password         String
  name             String
  role             Role
  walletAddress    String?  @unique
  phone            String?
  country          String?
  organizationName String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  // Trade relations
  tradesAsImporter     Trade[]  @relation("ImporterTrades")
  tradesAsExporter     Trade[]  @relation("ExporterTrades")
  tradesAsImporterBank Trade[]  @relation("ImporterBankTrades")
  tradesAsExporterBank Trade[]  @relation("ExporterBankTrades")
  tradesAsShipping     Trade[]  @relation("ShippingTrades")
  tradesAsCustoms      Trade[]  @relation("CustomsTrades")
  tradesAsTaxAuthority Trade[]  @relation("TaxAuthorityTrades")

  // Other relations
  offers               MarketplaceOffer[]
  listings             MarketplaceListing[]
  uploadedDocuments    Document[]
  tradeEvents          TradeEvent[]
  locAsImporterBank    LetterOfCredit[] @relation("LoCImporterBank")
  locAsExporterBank    LetterOfCredit[] @relation("LoCExporterBank")
  bolAsShipping        BillOfLading[]
  customsVerifications CustomsVerification[]
  dutyAssessments      DutyAssessment[]
}

// ─── Trade ────────────────────────────────────────────────────

model Trade {
  id               String      @id @default(uuid())
  blockchainId     Int?        @unique
  blockchainTxHash String?
  status           TradeStatus @default(OPEN_FOR_OFFERS)

  // Importer's trade request fields
  importerId           String
  productName          String
  quantity             String
  destination          String
  priceRange           String?
  shippingDeadline     DateTime?
  insuranceRequired    Boolean   @default(false)
  qualityStandards     String?
  additionalConditions String?

  // Participants (set as the trade progresses)
  exporterId       String?
  importerBankId   String?
  exporterBankId   String?
  shippingId       String?
  customsOfficerId String?
  taxAuthorityId   String?

  // Financials
  amount      Float
  dutyAmount  Float?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  importer     User  @relation("ImporterTrades",     fields: [importerId],     references: [id])
  exporter     User? @relation("ExporterTrades",     fields: [exporterId],     references: [id])
  importerBank User? @relation("ImporterBankTrades", fields: [importerBankId], references: [id])
  exporterBank User? @relation("ExporterBankTrades", fields: [exporterBankId], references: [id])
  shipping     User? @relation("ShippingTrades",     fields: [shippingId],     references: [id])
  customs      User? @relation("CustomsTrades",      fields: [customsOfficerId], references: [id])
  taxAuthority User? @relation("TaxAuthorityTrades", fields: [taxAuthorityId], references: [id])

  offers              MarketplaceOffer[]
  letterOfCredit      LetterOfCredit?
  billOfLading        BillOfLading?
  customsVerification CustomsVerification?
  dutyAssessment      DutyAssessment?
  documents           Document[]
  events              TradeEvent[]
}

// ─── MarketplaceOffer ─────────────────────────────────────────

model MarketplaceOffer {
  id                 String      @id @default(uuid())
  tradeId            String
  exporterId         String
  amount             Float                       // Price Quotation (USD)
  shippingTimeline   String                      // e.g. "12–15 business days"
  termsAndConditions String                      // Exporter's T&C
  deliveryTerms      String      @default("CIF") // Incoterms
  message            String?                     // Optional extra note
  validUntil         DateTime?
  status             OfferStatus @default(PENDING)
  createdAt          DateTime    @default(now())
  updatedAt          DateTime    @updatedAt

  trade    Trade @relation(fields: [tradeId],   references: [id])
  exporter User  @relation(fields: [exporterId], references: [id])
}

// ─── LetterOfCredit ───────────────────────────────────────────

model LetterOfCredit {
  id              String    @id @default(uuid())
  tradeId         String    @unique
  importerBankId  String
  exporterBankId  String?
  amount          Float
  expiryDate      DateTime
  ipfsHash        String?
  documentTxHash  String?
  status          LoCStatus @default(REQUESTED)
  uploadedAt      DateTime?
  approvedAt      DateTime?
  fundsLockedAt   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  trade        Trade  @relation(fields: [tradeId],        references: [id])
  importerBank User   @relation("LoCImporterBank", fields: [importerBankId], references: [id])
  exporterBank User?  @relation("LoCExporterBank", fields: [exporterBankId], references: [id])
}

// ─── BillOfLading ─────────────────────────────────────────────

model BillOfLading {
  id                String    @id @default(uuid())
  tradeId           String    @unique
  shippingCompanyId String
  bolNumber         String
  vesselName        String?
  portOfLoading     String
  portOfDischarge   String
  estimatedArrival  DateTime?
  goodsAccepted     Boolean   @default(true)
  rejectionReason   String?
  ipfsHash          String?
  documentTxHash    String?
  issuedAt          DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  trade           Trade @relation(fields: [tradeId],           references: [id])
  shippingCompany User  @relation(fields: [shippingCompanyId], references: [id])
}

// ─── CustomsVerification ──────────────────────────────────────

model CustomsVerification {
  id               String    @id @default(uuid())
  tradeId          String    @unique
  customsOfficerId String
  isCleared        Boolean?
  remarks          String?
  ipfsHash         String?
  documentTxHash   String?
  verifiedAt       DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  trade          Trade @relation(fields: [tradeId],          references: [id])
  customsOfficer User  @relation(fields: [customsOfficerId], references: [id])
}

// ─── DutyAssessment ───────────────────────────────────────────

model DutyAssessment {
  id             String     @id @default(uuid())
  tradeId        String     @unique
  taxAuthorityId String
  dutyAmount     Float
  tariffRate     Float?
  taxType        String?
  description    String?
  status         DutyStatus @default(ASSESSED)
  notifiedAt     DateTime?
  paidAt         DateTime?
  paymentTxHash  String?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  trade        Trade @relation(fields: [tradeId],        references: [id])
  taxAuthority User  @relation(fields: [taxAuthorityId], references: [id])
}

// ─── Document ─────────────────────────────────────────────────

model Document {
  id                String       @id @default(uuid())
  tradeId           String
  uploadedById      String
  uploadedByRole    Role
  type              DocumentType
  fileName          String
  fileSize          Int?
  mimeType          String?
  ipfsHash          String
  ipfsGatewayUrl    String?
  blockchainTxHash  String?
  createdAt         DateTime     @default(now())

  trade      Trade @relation(fields: [tradeId],      references: [id])
  uploadedBy User  @relation(fields: [uploadedById], references: [id])
}

// ─── TradeEvent (Audit Log) ───────────────────────────────────

model TradeEvent {
  id         String   @id @default(uuid())
  tradeId    String
  actorId    String?
  actorRole  String
  event      String
  fromStatus String?
  toStatus   String?
  txHash     String?
  ipfsHash   String?
  metadata   Json?
  createdAt  DateTime @default(now())

  trade Trade @relation(fields: [tradeId], references: [id])
  actor User? @relation(fields: [actorId], references: [id])
}

// ─── MarketplaceListing ───────────────────────────────────────

model MarketplaceListing {
  id         String   @id @default(uuid())
  productId  String
  exporterId String
  price      Float
  quantity   Int
  status     String   @default("ACTIVE")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  product  Product @relation(fields: [productId],  references: [id])
  exporter User    @relation(fields: [exporterId], references: [id])
}

// ─── Product & Category ───────────────────────────────────────

model Category {
  id       String    @id @default(uuid())
  name     String    @unique
  products Product[]
}

model Product {
  id          String    @id @default(uuid())
  name        String
  description String?
  categoryId  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  category Category?           @relation(fields: [categoryId], references: [id])
  listings MarketplaceListing[]
}
```
