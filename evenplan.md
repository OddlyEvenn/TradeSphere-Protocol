# TradeSphere Protocol -- Master AI Prompt

I am building a **(TradeSphere Protocol)** Blockchain-Based Trade
Finance System that replaces traditional Letter of Credit (LoC)
processes using Smart Contracts.

## Corrected Trade Lifecycle

1.  Importer requests LoC from Importer's Bank\
2.  Importer's Bank checks creditworthiness\
3.  Importer's Bank locks funds\
4.  Importer's Bank issues LoC\
5.  LoC sent to Exporter's Bank\
6.  Exporter's Bank notifies Exporter\
7.  Exporter ships goods\
8.  Documents submitted\
9.  Banks verify documents\
10. If documents match → Importer's Bank releases payment

------------------------------------------------------------------------

## 🔥 Smart Contract Architecture (Very Important)

The system must include **4 separate Solidity smart contracts**, equally
weighted in complexity, modular, and interacting through interfaces.

Additionally, the architecture must conceptually apply a
**Semaphore-based synchronization model**, where critical state
transitions require approvals from multiple roles before execution.

This means certain actions (like document verification or payment
authorization) should only proceed when multiple stakeholders (e.g.,
customs + bank, or importer + bank) have independently approved the step
--- similar to a semaphore in operating systems that requires multiple
signals before allowing execution.

------------------------------------------------------------------------

### 1️⃣ TradeRegistry.sol

-   Manages trade creation and lifecycle\
-   Stores trade participants (importer, exporter, banks)\
-   Implements state machine using enum\
-   Controls valid state transitions\
-   Emits lifecycle events\
-   Acts as central coordinator

------------------------------------------------------------------------

### 2️⃣ LetterOfCredit.sol

-   Handles LoC lifecycle\
-   Implements:
    -   LoC request\
    -   Credit approval\
    -   Funds locking\
    -   LoC issuance\
-   Includes expiry mechanism\
-   Includes bank-only role modifiers\
-   Emits LoC-related events\
-   Updates TradeRegistry status via interface

------------------------------------------------------------------------

### 3️⃣ DocumentVerification.sol

-   Stores IPFS hash of documents\
-   Handles shipment confirmation\
-   Handles customs clearance\
-   Handles bank document verification\
-   Requires multi-role verification before marking verified
    (Semaphore-style approval model)\
-   Emits verification events\
-   Interacts with TradeRegistry

------------------------------------------------------------------------

### 4️⃣ PaymentSettlement.sol

-   Implements escrow authorization logic\
-   Allows importer to confirm goods received\
-   Automatically authorizes payment only if:
    -   Documents verified\
    -   Goods confirmed received\
    -   Required multi-role confirmations completed (Semaphore-based
        control)\
-   Emits PaymentAuthorized event\
-   Does NOT transfer fiat directly (fiat remains off-chain)\
-   Backend listens to event and triggers bank API\
-   Includes timeout logic and dispute mechanism

------------------------------------------------------------------------

## ⚠️ Architectural Rules

-   Store only trade state on-chain\
-   Store private financial data off-chain\
-   Use events heavily for backend synchronization\
-   Use interfaces for inter-contract communication\
-   Use role-based access control\
-   Follow proper state machine design\
-   Enforce multi-role approval (Semaphore-style synchronization) before
    critical state transitions

------------------------------------------------------------------------

## Technical Requirements

### Blockchain

-   Solidity\
-   Hardhat\
-   Deploy to Polygon Amoy\
-   Use MetaMask\
-   Use Alchemy RPC\
-   Use IPFS for documents

------------------------------------------------------------------------

### Backend

-   Node.js + Express (MVC structure)\
-   Only .ts files\
-   cookie-parser\
-   JWT stored in HTTP-only cookies\
-   Redis for session caching and blockchain event tracking\
-   Global error handler\
-   Middleware-based architecture

------------------------------------------------------------------------

### Frontend

-   React (strict) & tsx\ 
-   Tailwind v3.4\
-   Axios centralized API config\
-   JWT in cookies only\
-   Brevo API for emails\
-   Fully responsive\
-   No CSRF token

------------------------------------------------------------------------

## Output Required

-   Phase-wise development plan\
-   Detailed smart contract architecture\
-   Backend structure (MVC)\
-   Frontend structure\
-   Redis usage design\
-   Security considerations\
-   Deployment plan

**Focus more on blockchain logic than UI features.**
