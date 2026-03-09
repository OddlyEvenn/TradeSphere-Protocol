-- TradeSphere Protocol: Database Schema (PostgreSQL)
-- Generated from schema.prisma

-- Enums
CREATE TYPE "Role" AS ENUM ('IMPORTER', 'EXPORTER', 'IMPORTER_BANK', 'EXPORTER_BANK', 'SHIPPING', 'CUSTOMS', 'TAX_AUTHORITY', 'REGULATORS', 'INSURANCE');
CREATE TYPE "TradeStatus" AS ENUM ('OPEN_FOR_OFFERS', 'OFFER_ACCEPTED', 'TRADE_INITIATED', 'LOC_INITIATED', 'LOC_UPLOADED', 'LOC_APPROVED', 'FUNDS_LOCKED', 'SHIPPING_ASSIGNED', 'GOODS_SHIPPED', 'CUSTOMS_UNDER_REVIEW', 'CUSTOMS_CLEARED', 'DUTY_PENDING', 'DUTY_PAID', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED', 'DISPUTED', 'EXPIRED');
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');
CREATE TYPE "LoCStatus" AS ENUM ('REQUESTED', 'UPLOADED', 'APPROVED', 'FUNDS_LOCKED', 'EXPIRED');
CREATE TYPE "DutyStatus" AS ENUM ('ASSESSED', 'NOTIFIED', 'PAID');
CREATE TYPE "DocumentType" AS ENUM ('LETTER_OF_CREDIT', 'BILL_OF_LADING', 'CUSTOMS_CERTIFICATE', 'TAX_CLEARANCE', 'TRADE_AGREEMENT', 'INSURANCE_CERTIFICATE', 'OTHER');

-- Users Table
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "walletAddress" TEXT UNIQUE,
    "phone" TEXT,
    "country" TEXT,
    "organizationName" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- Trades Table
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockchainId" INTEGER UNIQUE,
    "blockchainTxHash" TEXT,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN_FOR_OFFERS',
    "importerId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "priceRange" TEXT,
    "shippingDeadline" TIMESTAMP,
    "insuranceRequired" BOOLEAN NOT NULL DEFAULT FALSE,
    "qualityStandards" TEXT,
    "additionalConditions" TEXT,
    "exporterId" TEXT,
    "importerBankId" TEXT,
    "exporterBankId" TEXT,
    "shippingId" TEXT,
    "customsOfficerId" TEXT,
    "taxAuthorityId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "dutyAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("importerId") REFERENCES "User"("id"),
    FOREIGN KEY ("exporterId") REFERENCES "User"("id"),
    FOREIGN KEY ("importerBankId") REFERENCES "User"("id"),
    FOREIGN KEY ("exporterBankId") REFERENCES "User"("id"),
    FOREIGN KEY ("shippingId") REFERENCES "User"("id"),
    FOREIGN KEY ("customsOfficerId") REFERENCES "User"("id"),
    FOREIGN KEY ("taxAuthorityId") REFERENCES "User"("id")
);

-- Marketplace Offers
CREATE TABLE "MarketplaceOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "exporterId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "shippingTimeline" TEXT NOT NULL,
    "termsAndConditions" TEXT NOT NULL,
    "deliveryTerms" TEXT NOT NULL DEFAULT 'CIF',
    "message" TEXT,
    "validUntil" TIMESTAMP,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id"),
    FOREIGN KEY ("exporterId") REFERENCES "User"("id")
);

-- Letters of Credit
CREATE TABLE "LetterOfCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL UNIQUE,
    "importerBankId" TEXT NOT NULL,
    "exporterBankId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "expiryDate" TIMESTAMP NOT NULL,
    "ipfsHash" TEXT,
    "documentTxHash" TEXT,
    "status" "LoCStatus" NOT NULL DEFAULT 'REQUESTED',
    "uploadedAt" TIMESTAMP,
    "approvedAt" TIMESTAMP,
    "fundsLockedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id"),
    FOREIGN KEY ("importerBankId") REFERENCES "User"("id"),
    FOREIGN KEY ("exporterBankId") REFERENCES "User"("id")
);

-- Bills of Lading
CREATE TABLE "BillOfLading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL UNIQUE,
    "shippingCompanyId" TEXT NOT NULL,
    "bolNumber" TEXT NOT NULL,
    "vesselName" TEXT,
    "portOfLoading" TEXT NOT NULL,
    "portOfDischarge" TEXT NOT NULL,
    "estimatedArrival" TIMESTAMP,
    "goodsAccepted" BOOLEAN NOT NULL DEFAULT TRUE,
    "rejectionReason" TEXT,
    "ipfsHash" TEXT,
    "documentTxHash" TEXT,
    "issuedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id"),
    FOREIGN KEY ("shippingCompanyId") REFERENCES "User"("id")
);

-- Documents Table
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedByRole" "Role" NOT NULL,
    "type" "DocumentType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "ipfsHash" TEXT NOT NULL,
    "ipfsGatewayUrl" TEXT,
    "blockchainTxHash" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id"),
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
);

-- Audit Log Table
CREATE TABLE "TradeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tradeId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "txHash" TEXT,
    "ipfsHash" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("tradeId") REFERENCES "Trade"("id"),
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
);
