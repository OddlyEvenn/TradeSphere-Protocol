# TradeSphere Protocol – Frontend Dashboard Architecture

This document defines the **role-based frontend dashboard structure** for the TradeSphere Protocol Trade Finance System.

The system follows a **multi-portal architecture**, where each stakeholder interacts with the trade lifecycle according to their role.

---

# Global UI Layout

## Top Navigation Bar
TradeSphere Protocol  
Dashboard | Trades | Documents | Notifications  

AT TOP RIGHT  
[Connect Wallet] [Profile] [Logout]

Wallet connects to **MetaMask**.

---

## Sidebar Navigation
Dashboard  
Active Trades  
Documents  
Approvals  
History  
Settings  

---

# Phase 1 – Trade Marketplace (Exporter Discovery)

Before a Letter of Credit (LoC) is issued, the system provides a **Marketplace Phase** where importers can publish trade requirements and exporters can submit offers.

This allows the importer to **compare multiple exporters before selecting one for the final trade execution**.

TradeSphere therefore works in **two phases**:

1. **Marketplace Phase (Exporter selection)**
2. **Trade Execution Phase (LoC lifecycle on blockchain)**

---

## Marketplace Workflow

Importer creates Trade Request  
↓  
Exporters view open trade requests  
↓  
Exporters submit offers  
↓  
Importer compares offers  
↓  
Importer selects exporter  
↓  
Trade created  
↓  
LoC lifecycle begins

---

## Importer Marketplace Pages

### Create Trade Request Page

Importer publishes a trade request visible to exporters.

Form Fields

Product / Goods  
Quantity  
Destination Country  
Expected Price Range  
Shipping Deadline  
Insurance Required  
Additional Conditions

After submission:

Trade Status = **OPEN_FOR_OFFERS**

---

### View Exporter Offers Page

Importer can see **all exporters who submitted offers for the trade request**.

Table Structure

Exporter Company  
Offered Price  
Shipping Time  
Insurance Included  
Exporter Rating  
Exporter Bank  

Actions

View Details  
Negotiate  
Accept Offer  
Reject Offer

---

### Offer Details Page

Shows detailed proposal submitted by exporter.

Exporter Company  
Exporter Bank  
Price Breakdown  
Shipping Method  
Insurance Coverage  
Documents Prepared  
Exporter Reputation Score

Actions

Accept Offer  
Negotiate Terms  
Reject Offer

---

### Accept Offer

When the importer accepts an exporter’s offer:

Selected Exporter assigned  
Exporter Bank assigned  
Trade created

Trade Status = **CREATED**

Now the system transitions to **Phase 2 – Trade Execution using Letter of Credit**.

---

# Importer Portal

## Dashboard

### Key Metrics
Active Trades  
Pending LoC Requests  
Payments Pending  
Completed Trades  

### Widgets
Recent Trade Activity  
Trade Status Timeline  
Notifications  

---

## Create Trade Page

Importer initiates a new trade after selecting an exporter from the marketplace.

### Form Fields
Exporter  
Exporter Bank  
Importer Bank  
Trade Amount  
Goods Description  
Shipping Date  
Insurance Required  

### Action
Request Letter of Credit  

---

## My Trades Page

### Table Structure
Trade ID  
Exporter  
Amount  
Current Status  
Documents  
Actions  

### Actions
View Trade  
Confirm Goods Received  
Raise Dispute  

---

## Trade Details Page

Trade lifecycle visualization.

Trade Created  
LoC Requested  
LoC Issued  
Goods Shipped  
Documents Submitted  
Documents Verified  
Payment Authorized  

---

# Exporter Portal

## Dashboard

### Key Metrics
Active Shipments  
Pending Document Submission  
Verified Trades  
Payments Awaiting  

---

## Trade Notifications Page

Exporter receives LoC notification.

### Actions
Accept Trade  
Reject Trade  

---

## Upload Documents Page

Documents uploaded and stored on **IPFS**.

### Required Documents
Bill of Lading  
Commercial Invoice  
Packing List  
Insurance Certificate  

---

## Shipment Confirmation Page

Exporter confirms goods shipment.

Confirm Shipment  

---

# Importer Bank Portal

## Dashboard

### Metrics
Pending LoC Requests  
Approved Credit Lines  
Locked Funds  
Payments Pending  

---

## LoC Requests Page

### Table
Trade ID  
Importer  
Exporter  
Amount  
Credit Score  

### Actions
Approve Credit  
Reject Request  
Lock Funds  
Issue LoC  

---

## Payment Authorization Page

After document verification.

Authorize Payment  

Triggers smart contract event:

PaymentAuthorized  

Backend listens and triggers.

---

# Exporter Bank Portal

## Dashboard Metrics
Received LoCs  
Pending Document Verification  
Verified Trades  
Payment Notifications  

---

## Document Verification Page

### Actions
Verify Documents  
Request Clarification  
Reject Documents  

Contributes to **multi-party verification (Semaphore model)**.

---

# Customs Portal

## Dashboard Metrics
Shipments Awaiting Inspection  
Cleared Shipments  
Flagged Shipments  

---

## Shipment Verification Page

### Actions
Approve Customs Clearance  
Reject Shipment  
Request Re-inspection  

Provides **semaphore approval signal**.

---

# Shipping Authority Portal

## Dashboard Metrics
Active Shipments  
Pending Shipment Confirmations  
Completed Shipments  

---

## Shipment Confirmation Page

### Actions
Confirm Cargo Loaded  
Confirm Departure  
Confirm Delivery  

Adds shipment proof to blockchain.

---

# Insurance Portal

## Dashboard Metrics
Active Policies  
Claims Raised  
Verified Shipments  

---

## Issue Insurance Page
Trade ID  
Policy Number  
Coverage Amount  

### Action
Issue Insurance Certificate  

---

## Claims Handling Page
Approve Claim  
Reject Claim  

---

# Tax Authority Portal

## Dashboard Metrics
Pending Tax Filings  
Completed Filings  
Flagged Trades  

---

## Tax Compliance Page

### Actions
Verify Tax Declaration  
Approve  
Flag Trade  

---

# Regulator Portal

## Dashboard Metrics
Total Trades  
Suspicious Trades  
Compliance Alerts  
Trade Volume  

---

## Audit Dashboard

### Features
Trade Search  
Smart Contract Event Logs  
Document Audit  
Compliance Status  

---

# Global Notification Center

Receives blockchain events.

LoC Issued  
Documents Submitted  
Documents Verified  
Payment Authorized  

---

# Trade Status Badges

CREATED  
LOC_REQUESTED  
LOC_ISSUED  
GOODS_SHIPPED  
DOCS_SUBMITTED  
DOCS_VERIFIED  
PAYMENT_AUTHORIZED  
COMPLETED  
DISPUTED  

---

# Trade Timeline Component

Used across all portals.

Trade Created  
↓  
LoC Issued  
↓  
Shipment  
↓  
Docs Submitted  
↓  
Docs Verified  
↓  
Payment Authorized