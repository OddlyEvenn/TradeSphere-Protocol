# Phase 1: Smart Contract Architecture & Logic Updates

## 1. Architectural Overview & Separation of Concerns
To ensure scalability, maintainability, and upgradeability, we will apply the principle of separation of concerns to the smart contract architecture:
- **Logic Contracts**: Will house the core business logic, trade processing, voting mechanisms, and SLA enforcement.
- **Storage Contracts**: Dedicated exclusively to persisting state variables (e.g., Trade details, Escrow mappings, Stakeholder registries).
- **Proxy Contracts**: Enable an upgradeable architecture, allowing logic to be updated without disrupting service or losing stored data.

### Evaluation & Optimization Dimensions
While updating the contracts, we will evaluate and optimize for:
- **Throughput (TPS)**: Optimizing state changes and minimizing bottlenecks to support concurrent trade resolutions.
- **Finality Time**: Ensuring contract executions and state mutations happen quickly to reflect real-time logistics.
- **Transaction Cost (Gas Fees)**: Packing storage variables, avoiding redundant memory writes, and optimizing logic flows to reduce gas consumption.

## 2. Core Contract Updates

### A. Entity Modifications
- **Remove Regulator**: Eradicate all instances of the `Regulator` role from the Stakeholders list and Role-Based Access Control (RBAC) across all contracts.
- **Merge Custom & Tax Authority**: Combine "Customs" and "Tax Authority" into a single entity/node.
  - Implement 3 distinct status options for this entity:
    - **`0: clear`**: No tax imposed; trade is marked safe to proceed.
    - **`1: flags`**: Prompts the option to calculate and add a required tax amount.
    - **`2: entry rejection`**: Instantly changes the trade status to `Dispute`.

### B. Voting & Dispute Mechanics
- **Trigger**: When Customs selects `ENTRY_REJECTION` (Status 2).
- **Process**:
  - Automatically activate the 7 Voting Nodes.
  - Initiate a 24-hour voting timer enforced at the block timestamp level.
  - **Inspector Input**: Incorporate a specific function for the Inspector to submit a decision (`yes` or `no`) bundled with the reason: `cargo damaged`, `safe`, or `fake documents`.
- **Effects & SLA**:
  - Automatic SLA breaches are executed on-chain via the contract based on the timestamp or Inspector findings.
  - Enable the Exporter to trigger an internal insurance claim function if the Inspector marks the goods as `cargo damaged`.

### C. Resolution Scenarios
- Establish a strict threshold of **4 votes passing** to decide the outcome.
- **Condition 1 (Votes < 4)**: The transaction does NOT revert.
- **Condition 2 (Votes >= 4)**: The transaction fully Reverts. The contracts are triggered to automatically return the locked Escrow funds back to the Importer.
