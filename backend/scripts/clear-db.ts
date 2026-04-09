import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Database Cleanup (Preserving Users)...');

    try {
        // Order matters for foreign key constraints
        console.log('🗑️ Deleting TradeEvents...');
        await prisma.tradeEvent.deleteMany({});

        console.log('🗑️ Deleting Documents...');
        await prisma.document.deleteMany({});

        console.log('🗑️ Deleting CustomsVerifications...');
        await prisma.customsVerification.deleteMany({});

        console.log('🗑️ Deleting BillOfLadings...');
        await prisma.billOfLading.deleteMany({});

        console.log('🗑️ Deleting LetterOfCredits...');
        await prisma.letterOfCredit.deleteMany({});

        console.log('🗑️ Deleting MarketplaceOffers...');
        await prisma.marketplaceOffer.deleteMany({});

        console.log('🗑️ Deleting MarketplaceListings...');
        await prisma.marketplaceListing.deleteMany({});

        console.log('🗑️ Deleting Trades...');
        await prisma.trade.deleteMany({});

        console.log('🗑️ Deleting Products...');
        await prisma.product.deleteMany({});

        console.log('🗑️ Deleting Categories...');
        await prisma.category.deleteMany({});

        const userCount = await prisma.user.count();
        console.log(`✅ Success! All trade data cleared.`);
        console.log(`👤 ${userCount} User accounts preserved.`);

    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
