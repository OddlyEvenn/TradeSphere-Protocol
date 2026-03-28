# Phase 4: Backend Logic & Flow Implementation

## 1. Global Entity Updates
- **Remove Regulator**: Clean the database models, REST APIs, and middleware logic associated with the `Regulator` stakeholder. 
- **Merge Custom & Tax Authority**: Consolidate database entities, roles, and API routes into a single `Custom & Tax Authority`. Ensure this entity handles the three action states: `clear`, `flags`, and `entry rejection`.

## 2. Trade Workflow Logic Implementation
### A. Trade Initialization & Escrow
- Implement backend flows for trade finalization:
  - Process the Importer requesting a Letter of Credit (LOC) from their bank.
  - Route the LOC for the Exporter dropping it to their bank for approval.
  - Upon LOC approval, execute Web3 integrations from the backend pointing to the Smart Contracts to **lock funds** securely in the Importer Bank's Escrow.

### B. Shipping Integration
- Support the Importer's selection of a Shipping Company.
- Hook into the background logic that intrinsically ties the selected Shipping Company to specific insurance coverage.
- Expose the API for the Shipping Company to officially issue the Bill of Lading (BoL) and mark goods as shipped.

### C. Customs Evaluation Flows
Develop backend routers that process the Customs' decision upon goods arrival:
- **IF 0 (clear)**: Register "no tax", proceed to Importer confirmation module, trigger smart contract to release funds from escrow.
- **IF 1 (flags)**: Associate a tax liability object. Monitor for external tax payment by the Exporter. Once verified, clear Customs and trigger the Importer confirmation to release escrow funds.
- **IF 2 (ENTRY REJECTION)**:
  - Transition trade status to `Dispute`.

### D. Voting & Dispute Logic Implementation
- When `entry rejection` is flagged, initiate the **24-hour backend timer** to monitor the voting phase.
- Broadcast activation to the 7 Voting Nodes.
- Expose an endpoint specifically for the **Inspector** passing payload fields for `decision` (`yes/no`) and `reason` (`cargo damaged`, `safe`, or `fake documents`).
- Run background chron-jobs or contract events to mark automatic SLA breaches.
- If goods are checked as `cargo damaged`, unlock the route for the Exporter to submit an insurance claim.
- Conclude voting: Compute if the 4-vote threshold is met to revert the transaction and command the Escrow to refund the Importer.
