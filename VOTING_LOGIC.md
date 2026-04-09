# TradeSphere Protocol: Voting Consensus & Revert Logic

This document details the decentralized consensus mechanism used to resolve high-stakes trade disputes, specifically following an `ENTRY_REJECTED` event from Customs.

---

## 1. Decentralized Voting Logic (7-Node Consensus)

When a trade is flagged with an entry rejection, the protocol moves into the `VOTING_ACTIVE` state. A **24-hour window** is opened for the primary stakeholders to cast their votes.

### The 7 Voting Nodes (why 7?)
The system uses an **odd number (7)** of nodes to ensure there are no deadlocks or ties in the final decision. Every node carries exactly **1 vote (equal weight)**.

| Node Name | Stakeholder Role | Justification for Voting Power |
| :--- | :--- | :--- |
| **Exporter** | Seller | Direct financial stake; ensures they are not unfairly penalized. |
| **Importer** | Buyer | Direct commercial stake; ensures goods meet requirements. |
| **Issuing Bank** | Importer's Bank | Protects the buyer's capital and manages the LoC escrow. |
| **Advising Bank** | Exporter's Bank | Protects the seller's payment and settlement integrity. |
| **Customs Authority** | Government | Verifies legal compliance, taxes, and manifest accuracy. |
| **Inspector Node** | Auditor | Provides physical verification (SGS/Bureau Veritas style). |
| **Insurance Node** | Underwriter | Evaluates liability and handles damage claims. |

**Consensus Threshold:** A simple majority of **4 out of 7 votes** is required to trigger a final action (Revert or Resolve).

---

## 2. Decision Scenarios (4 Key Use Cases)

| Scenario | Dispute Trigger | Critical Evidence | Consensus Decision | Outcome |
| :--- | :--- | :--- | :--- | :--- |
| **1. Massive Cargo Damage** | Goods arrived destroyed at port. | Inspector Report + IPFS Photos. | **REVERT (4+ Votes)** | Trade is aborted; Funds returned. |
| **2. Document Fraud** | BoL doesn't match Digital Twin hash. | Hash Mismatch on-chain. | **REVERT (4+ Votes)** | Potential blacklisting; Funds returned. |
| **3. Minor SLA Breach** | Delivery is 2 hours late. | Smart Contract NTP Time. | **NO REVERT (<4 Votes)** | Trade proceeds; Small penalty applied. |
| **4. Unjust Rejection** | Customs rejected without proof. | Lack of legal evidence. | **NO REVERT (<4 Votes)** | Dispute resolved; Trade moves to receiver. |

---

## 3. The "Transaction Revert" Mechanism

A "Transaction Revert" in the TradeSphere Protocol is a formal **State Revert & Escrow Refund** process. 

### What it *is* not:
It is **not** a deletion of blockchain history. All logs, votes, and events remain on-ledger for auditing.

### What it *is*:
It is an automated recovery flow that triggers two simultaneous actions:
1.  **State Reset:** The `TradeStatus` moves to `TRADE_REVERTED_BY_CONSENSUS`. This locks the trade from any further standard processing (Payment/Received).
2.  **Autonomous Refund:** The Smart Contract vault (escrow) triggers an immediate transfer of the locked funds back to the **Issuing Bank** (to be credited to the Importer).

---

## 4. Timeline & SLA (24-Hour Rule)

*   **Window Opens:** Triggered by `ENTRY_REJECTED`.
*   **Window Closes:** Exactly **24 hours** after opening.
*   **Auto-Finalization:** If the threshold (4 votes) is reached before 24 hours, the system finalizes the decision immediately.
*   **Default Closure:** If 24 hours pass without a 4-vote majority for "Revert", the dispute is resolved as "No Revert" unless an SLA breach is filed.
