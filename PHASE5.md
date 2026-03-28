# Phase 5: Frontend Design, UI & Complete Flow Assembly

## 1. Entity Dashboard Makeovers
- **Remove Regulator**: Eliminate the Regulator login profile, sidebar links, dashboards, and associated status indicators globally across the React/Next.js frontend.
- **Merge Custom & Tax Authority**: 
  - Design a unified Dashboard for "Custom & Tax Authority".
  - Implement a streamlined interface containing 3 primary action options upon inspecting goods:
    1. **Clear**: Fast-tracks the workflow indicating no tax is owed.
    2. **Flags**: Opens an interactive form to input the required Tax Amount for the Exporter.
    3. **Entry Rejection**: A high-contrast alert marking the trade Status as "Dispute".

## 2. The Final Trade Flow UI implementation
- **LOC & Escrow Assembly**:
  - Importer Interface: Forms to initialize trades and request LOCs.
  - Exporter Interface: Bank approval trackers.
  - UI State Indicators showing visually that funds have successfully been locked via Escrow.
- **Shipping & Insurance Views**:
  - Allow the Importer to select Shipping Companies from a list clearly indicating the tied-up background insurance coverage.
  - Real-time tracker components showing the issuance of the Bill of Lading (BoL).

## 3. Dispute Resolution & Voting Engine Views
When a trade hits **ENTRY REJECTION**, execute the specialized Dispute UI:
- **Timer Components**: Expose a global 24-hour countdown timer to relevant stakeholders.
- **Voting Nodes Activation**: Provide a dashboard tailored for the 7 active Voting Nodes to submit their consensus.
- **Inspector Form**: 
  - A highly specific form component displaying field options for Decision (`Yes`/`No`) combined with dropdown attributes: `cargo damaged`, `safe`, or `fake documents`.
- **Claim Processing**: Create an intuitive UI flow allowing Exporters to file Insurance Claims easily if the status reads `cargo damaged`.

## 4. Scenario Outcomes Rendering
Ensure flawless visual updates based on final voting thresholds:
- **If Votes < 4**: Alert the users that no revert has occurred, maintaining the state context.
- **If Votes >= 4**: Display a clear "Transaction Reverted" interface, visually confirming Escrow funds have been returned to the Importer's interface. 

*Ensure all form fields, API bindings, Web3 signature prompts, and state trackers are tied up tightly and function precisely as outlined in the core requirements.*
