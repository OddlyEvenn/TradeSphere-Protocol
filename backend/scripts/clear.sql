-- Disable triggers to avoid foreign key checks if necessary (Postgres specific)
-- TRUNCATE is faster and resets identities

TRUNCATE TABLE "TradeEvent", "Document", "CustomsVerification", "BillOfLading", "LetterOfCredit", "MarketplaceOffer", "MarketplaceListing", "Trade", "Product", "Category" RESTART IDENTITY CASCADE;
