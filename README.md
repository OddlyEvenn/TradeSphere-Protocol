# TradeSphere Protocol 🌐⚖️

TradeSphere Protocol is an enterprise-grade, decentralized Trade Finance ecosystem that digitizes the end-to-end lifecycle of global trade. By combining **Solidity Smart Contracts**, **IPFS Immutable Storage**, and a **Modern Glassmorphism UI**, it eliminates the inefficiencies of traditional manual Letter of Credit (LoC) and Bill of Lading (BoL) processes.

---

## 🏗️ Technical Architecture

### 🛡️ Smart Contract Suite (The Core)
The protocol lives on-chain through four specialized smart contracts:

1.  **`TradeRegistry`**: 
    -   Primary source of truth for all trades.
    -   Handles trade registration, multi-party actor assignments (Shipping, Banks, Customs).
    -   Maintains the global `TradeStatus` state machine.
2.  **`LetterOfCredit`**:
    -   Stores LoC document hashes (IPFS CIDs) on-chain for immutability.
    -   Enables Advising Banks to cryptographically approve LoCs.
    -   Manages the **Fund Escrow** lock-in mechanism.
3.  **`DocumentVerification`**:
    -   Shipping company interface to issue **Bill of Lading (BoL)**.
    -   Customs authority portal for digital inspection and clearance decisions.
    -   Triggers tax duty assessments and records compliance payments.
4.  **`PaymentSettlement`**:
    -   Records authorization of final bank-to-bank payments.
    -   Confirms off-chain fiat settlement for final trade closure.

### 🔗 Architecture Layers
- **Blockchain (Polygon Amoy)**: State control, escrow, and documentation hashes.
- **Off-Chain (PostgreSQL/IPFS)**: User profiles, marketplace listings, and raw document PDFs.
- **Backend (Node.js/Prisma)**: Indexing, real-time event listening, and API orchestration.

---

## 👥 Stakeholders & Functional Roles

| Role | Responsibility | Key Contract Interaction |
| :--- | :--- | :--- |
| **Importer** | Creates trade & requests LoC. | `TradeRegistry`, `PaymentSettlement` |
| **Exporter** | Proposes offers & manages shipment. | `TradeRegistry`, `LetterOfCredit` |
| **Importer Bank** | Issues LoC & locks escrow funds. | `LetterOfCredit.lockFunds()` |
| **Exporter Bank** | Reviews/Approves LoC & confirms settlement. | `LetterOfCredit.approveLoC()` |
| **Shipping Co.** | Handles cargo & issues Bill of Lading. | `DocVerification.issueBillOfLading()` |
| **Customs** | Inspects cargo & triggers duty assessment. | `DocVerification.verifyAsCustoms()` |
| **Tax Authority** | Assesses duty amount & records receipts. | `DocVerification.recordTaxReceipt()` |
| **Regulators** | Monitors the immutable audit trail. | Read-Only (Audit Ledger) |

---

## ⛓️ Trade Lifecycle: Every Step & Status

1.  **`OPEN_FOR_OFFERS`**: Trade request is live in the marketplace.
2.  **`OFFER_ACCEPTED`**: Exporter selected by Importer.
3.  **`TRADE_INITIATED`**: Legal agreement signed on-chain.
4.  **`LOC_INITIATED`**: Bank begins Letter of Credit process.
5.  **`LOC_UPLOADED`**: PDF document hash stored on blockchain and IPFS.
6.  **`LOC_APPROVED`**: Exporter's Bank confirms LoC safety.
7.  **`FUNDS_LOCKED`**: Funds held in cryptographic escrow.
8.  **`GOODS_SHIPPED`**: Shipping Co. issues BoL; cargo is in transit.
9.  **`CUSTOMS_UNDER_REVIEW`**: Goods undergoing physical & digital inspection.
10. **`DUTY_PENDING`**: Tax authority calculates required import tax.
11. **`DUTY_PAID`**: Importer completes tax payment to government.
12. **`CUSTOMS_CLEARED`**: Cargo released for local delivery.
13. **`PAYMENT_AUTHORIZED`**: Bank approves bank-to-bank fiat release.
14. **`SETTLEMENT_CONFIRMED`**: Funds confirmed landed in Exporter's bank.
15. **`COMPLETED`**: Final immutable settlement state.

---

## 📡 API Endpoints (Comprehensive)

**Base URL:** `http://localhost:5000/api`

| Module | Endpoint | Method | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `/auth/register` | `POST` | Create new stakeholder. |
| **Auth** | `/auth/login` | `POST` | Stakeholder JWT login. |
| **Auth** | `/auth/update-wallet` | `POST` | Map wallet address to user account. |
| **Trades** | `/trades` | `GET` | List all trades for current user. |
| **Trades** | `/trades` | `POST` | Create new trade (Importer only). |
| **Market** | `/marketplace/listings`| `GET` | View active trading opportunities. |
| **Docs** | `/documents/upload` | `POST` | Upload to IPFS & Blockchain hash. |

---

## 🦊 Configuration & Environment

### 1. MetaMask Settings
- **Network Name**: Polygon Amoy
- **RPC URL**: `https://rpc-amoy.polygon.technology/`
- **Chain ID**: `80002`
- **Currency Symbol**: `MATIC`

### 2. Environment Variables (`.env`)
Refer to `backend/.env.example` and `frontend/.env.example` for the full list of required keys (Alchemy, Pinata, JWT, etc.).

---

## 🚀 Execution Guide

1.  **Clean Start**: Run `stop_services` to clear ports 5173/5000.
2.  **Orchestration**: Run `run` in your root terminal.
3.  **Audit Logs**: Press `Ctrl+Shift+B` in VS Code to see split logs for Backend & Frontend.

---
*Built with ❤️ for a trustless global trade future.*
