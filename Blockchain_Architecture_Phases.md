# Complete Phase 2 On-Chain vs Off-Chain Architecture

This table shows the **ideal state** for your Trade Finance system according to your Solidity contracts (`TradeRegistry`, `LetterOfCredit`, `DocumentVerification`, and `PaymentSettlement`).

| Step | Action | **Off-Chain (Database / IPFS)** | **On-Chain (Blockchain)** | **Smart Contract Function Call** | **End State on Blockchain** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Request LoC | User clicks UI, DB updates to track intent. | ⚡ **REQUIRED** | `TradeRegistry.requestLetterOfCredit(tradeId)` | `LOC_INITIATED` |
| **2** | Assign Adv. Bank | DB tracks relationship. | ⚡ **REQUIRED** | `TradeRegistry.assignAdvisingBank(...)` | *(No state change)* |
| **3** | Upload LoC Doc | Bank uploads PDF -> Pinata -> gets **IPFS Hash**. | ⚡ **REQUIRED** | `LetterOfCredit.uploadLocDocument(...)` | `LOC_UPLOADED` |
| **4** | Approve LoC | Adv. Bank downloads PDF from IPFS and reviews. | ⚡ **REQUIRED** | `LetterOfCredit.approveLoC(tradeId)` | `LOC_APPROVED` |
| **5** | Lock Funds | Internally verifying fiat balance in bank DB. | ⚡ **REQUIRED** | `LetterOfCredit.lockFunds(tradeId)` | `FUNDS_LOCKED` |
| **6** | Assign Shipping | DB tracks shipping company. | ⚡ **REQUIRED** | `TradeRegistry.assignShippingCompany(...)` | *(No state change)* |
| **7** | Issue BoL | Shipping uploads BoL PDF -> gets IPFS Hash. | ⚡ **REQUIRED** | `DocumentVerification.issueBillOfLading(...)`| `GOODS_SHIPPED` |
| **8** | View BoL | User UI fetches IPFS hash from Blockchain. | ❌ *None* | Read `getBolIpfsHash(tradeId)` | *(No state change)* |
| **9** | Customs Review | Physical inspection & DB records. | ⚡ **REQUIRED** | `DocumentVerification.verifyAsCustoms(...)` | `CUSTOMS_CLEARED` or `DUTY_PENDING` |
| **10**| Duty Calc | Tax authority calculates duty in off-chain system.| ❌ *None* | Read status to trigger off-chain calc. | *(No state change)* |
| **11**| Pay Duty | Bank portal processes fiat duty payment. | ⚡ **REQUIRED** | `DocumentVerification.recordDutyPayment(...)`<br>then `releaseFromDuty(...)`| `DUTY_PAID` -> `CUSTOMS_CLEARED` |
| **12**| Regulator View | Regulator dashboard aggregates data continuously. | ❌ *None* | Listens to all `TradeStatusUpdated` events. | *(Read Only)* |
| **13**| Auth Payment | Importer bank approves the SWIFT transfer. | ⚡ **REQUIRED** | `PaymentSettlement.authorizePayment(tradeId)`| `PAYMENT_AUTHORIZED` |
| **14**| Fiat Settlement| Fiat SWIFT/Wire moves between banks. | ❌ *None* | *(Traditional Fiat network)* | *(No state change)* |
| **15**| Confirm Settled| Exporter bank verifies funds landed in account. | ⚡ **REQUIRED** | `PaymentSettlement.confirmSettlement(tradeId)`| `SETTLEMENT_CONFIRMED` -> `COMPLETED` |

---

## State-Wise Flow (Smart Contract Enums)

This section maps exactly how the `TradeStatus` enum transitions inside the smart contracts, who triggers the transition, and which function is called.

| Current State | Triggered By (Actor) | Smart Contract Function Call | Next State | Description |
| :--- | :--- | :--- | :--- | :--- |
| `(None)` | Importer | `TradeRegistry.createTrade()` | `OFFER_ACCEPTED` | Trade is officially logged on-chain. |
| `OFFER_ACCEPTED` | Both Parties | `TradeRegistry.confirmTrade()` | `TRADE_INITIATED` | Both importer and exporter sign off. |
| `TRADE_INITIATED` | Importer | `TradeRegistry.requestLetterOfCredit()`| `LOC_INITIATED` | Importer officially requests the LoC. |
| `LOC_INITIATED` | Importer Bank | `LetterOfCredit.uploadLocDocument()` | `LOC_UPLOADED` | Bank uploads LoC PDF to IPFS. |
| `LOC_UPLOADED` | Exporter Bank | `LetterOfCredit.approveLoC()` | `LOC_APPROVED` | Adv. Bank reviews and approves LoC. |
| `LOC_APPROVED` | Importer Bank | `LetterOfCredit.lockFunds()` | `FUNDS_LOCKED` | Escrow funds are officially locked. |
| `FUNDS_LOCKED` | Shipping Co. | `DocumentVerification.issueBillOfLading()` | `GOODS_SHIPPED` | BoL uploaded to IPFS. |
| `GOODS_SHIPPED` | Customs Auth | `DocumentVerification.verifyAsCustoms(..., true)`| `CUSTOMS_CLEARED` | Goods are clear to go. |
| `GOODS_SHIPPED` | Customs Auth | `DocumentVerification.verifyAsCustoms(..., false)`| `DUTY_PENDING` | Goods held for tax calculation. |
| `DUTY_PENDING` | Tax Authority | `DocumentVerification.recordDutyPayment()` | `DUTY_PAID` | Importer pays duty. |
| `DUTY_PAID` | Tax Authority | `DocumentVerification.releaseFromDuty()` | `CUSTOMS_CLEARED` | Goods released after tax is paid. |
| `CUSTOMS_CLEARED` | Importer Bank | `PaymentSettlement.authorizePayment()` | `PAYMENT_AUTHORIZED` | Bank OKs the fiat wire transfer. |
| `PAYMENT_AUTHORIZED`| Exporter Bank | `PaymentSettlement.confirmSettlement()` | `SETTLEMENT_CONFIRMED` | Fiat received. Contract auto-moves to `COMPLETED`. |
| `SETTLEMENT_CONFIRMED`| *(Auto-Trigger)*| *(Inside `confirmSettlement`)* | `COMPLETED` | Full Trade Lifecycle finished. |
