# Enterprise Trade Finance: System Architecture Plan

This document details the exact blockchain framework we will build into the smart contracts to support **Stakeholder Nodes**, **Custom SLAs**, **Consensus Voting**, and **Transaction Reverting**.

## User Review Required

> [!IMPORTANT]
> Please review the architecture below. It transforms simple status changes into robust, decentralized, enterprise-grade mechanisms.

---

## 1. The Stakeholder Nodes
We will build a strict `Role-Based Access Control (RBAC)` system. Every transaction must be signed by a verified node in the consortium.

- **Importer Node (Buyer):** Initiates trade, locks escrow funds (`FUNDS_LOCKED`).
- **Exporter Node (Seller):** Supplies goods, receives payment or insurance payout.
- **Issuing Bank Node (Importer's Bank):** Handles fiat gateway, authorizes locking and unlocking of actual escrow funds.
- **Advising Bank Node (Exporter's Bank):** Confirms settlement, protects the Exporter.
- **[NEW] Inspector Node:** Third-party auditor (e.g., SGS, Bureau Veritas) who physically checks cargo quality and quantity at the port.
- **[NEW] Customs Node:** Official government authority verifying legal compliance (taxes/duties).
- **[NEW] Insurance Node:** Underwrites risk, evaluates claims, and authorizes on-chain payouts to injured parties.

---

## 2. Our Own SLA Rules (Smart Contract Timers)
We will embed **Service Level Agreements (SLAs)** directly into the Solidity code. If these timers expire, the smart contract automatically allows alternative actions.

- **SLA Rule 1: Dynamic Shipping Deadline.** Because every shipping route is different, the `ShippingDeadline` is **not hardcoded**. Instead, it is agreed upon when the Importer and Exporter create the trade (e.g., `createTrade(..., arrivalDate)`). When funds are locked, the contract enforces this specific date. If the Exporter fails to issue the Bill of Lading (`GOODS_SHIPPED`) before this deadline, the Importer's Bank Node can programmatically trigger a **Transaction Revert** due to "SLA Breach".
- **SLA Rule 2: Clearance Deadline.** After goods arrive at the port, Customs and Inspectors have an SLA (e.g., `3 days`) to clear the cargo. If they exceed this, Demurrage fees are logged on-chain against the stalling party.

---

## 3. The Consensus Mechanism (Threshold Voting)
Instead of relying on a single Admin or single Customs officer to approve/reject a multi-million-dollar trade, we use a **Weighted Consensus Protocol**.

When a dispute is raised (e.g., "Goods are ruined" or "Fake documents"), an `OnChainDispute` state is initiated. Nodes vote based on off-chain cryptographic evidence.

**Weight Distribution & Node Roles:**
- **Inspector Node** = 2 points. *Role:* They saw the physical cargo. They vote: "Cargo is Damaged" or "Cargo is Intact".
- **Customs Node** = 1 point. *Role:* They verify legal compliance and manifest authenticity. They don't assess water damage. They vote: "Manifest Fake/Irregular" or "Taxes Unpaid" which also triggers a Revert.
- **Insurance Node** = 1 point. *Role:* They review Inspector photos/reports. They vote: "Approve Insurance Claim" or "Reject Claim".
- **Issuing Bank Node** = 1 point. *Role:* Represents the Importer's money. They check if the Bill of Lading matches the Letter of Credit terms. They vote: "Approve Revert to protect client" or "Reject Payment".

**The Threshold Rule:** To execute a major state change (like a Revert or Claim Payout), the total vote score must reach **>= 3 points**.

---

## 4. The Scenario: Cargo Damage & Transaction Revert
Here is the step-by-step technical lifecycle of how this system protects parties when something goes wrong.

1. **The Setup:** Trade is initiated. The Importer's Bank Node locks $100k in the smart contract escrow. Goods are shipped.
2. **The Incident:** Goods arrive at the destination port. The Inspector Node opens the shipping container and logs "Severe Water Damage". They trigger `raiseDispute(tradeId, IPFS_Photo_Hash)`.
3. **The Consensus Vote:**
   - The trade halts. Voting begins.
   - **Inspector Node** signs a vote: *Damaged* (+2 points).
   - **Insurance Node** reviews the IPFS photos and signs: *Approved Claim* (+1 point).
   - **Total Consensus** = 3 points. The Threshold is successfully reached!
4. **The Transaction Revert (Refund Logic):**
   - The Smart Contract state instantly switches to `TRADE_REVERTED`.
   - **The Escrow Unlock:** The $100k locked in the [PaymentSettlement.sol](file:///c:/Users/evanc/Desktop/BLOCKCHAIN-TRADE_FINANCE/contracts/PaymentSettlement.sol) vault is automatically and autonomously **transferred back** to the Importer Bank's balance. The Importer pays absolutely nothing for ruined goods.
5. **The Insurance Fulfillment:**
   - The **Insurance Node** is mathematically authorized to release $100k (minus deductibles) to the **Exporter Node** to cover the loss of goods at sea.

---

## 5. What "Reverting the Transaction" Actually Means on the Blockchain

It is critically important to understand how blockchain works here. We **DO NOT** erase, delete, or "undo" the previous steps (like Importer creating the trade, Banks approving the LoC, or Exporter shipping). 

Blockchain history is permanent. If we erased it, we would lose the audit trail proving that the Exporter broke the contract!

Instead, a **"Transaction Revert"** in this Trade Finance context means a **State Revert & Escrow Refund**:
1. **The Status Update:** The smart contract officially updates the `TradeStatus` from `GOODS_SHIPPED` to `TRADE_REVERTED_BY_CONSENSUS`.
2. **The Escrow Unlock:** The Smart Contract holds the Importer's $100k inside its own "Vault" (Escrow). The contract creates a *new, forward-moving* transaction that transfers the $100k out of the Contract Vault and **refunds it back into the Importer's wallet**.
3. **The Audit Trail:** The entire history (the initial agreements, the locked funds, and the final Inspector/Consensus votes proving the cargo was damaged) remains permanently visible on the blockchain. This allows regulators or courts to clearly see *why* the refund happened.

## Next Steps
This provides a highly advanced, trustless environment. 

Are we ready to begin updating [TradeRegistry.sol](file:///c:/Users/evanc/Desktop/BLOCKCHAIN-TRADE_FINANCE/contracts/TradeRegistry.sol), [DocumentVerification.sol](file:///c:/Users/evanc/Desktop/BLOCKCHAIN-TRADE_FINANCE/contracts/DocumentVerification.sol), and creating `ConsensusDispute.sol` to execute this logic?