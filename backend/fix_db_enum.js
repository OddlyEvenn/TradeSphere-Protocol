const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Adding "TRADE_REFUNDED" to "TradeStatus" enum...');
        // We use executeRawUnsafe because ADD VALUE cannot be executed inside a transaction block in some PG versions
        // and Prisma defaults to transactions for executeRaw template literals.
        await prisma.$executeRawUnsafe(`ALTER TYPE "TradeStatus" ADD VALUE IF NOT EXISTS 'TRADE_REFUNDED'`);
        console.log('Successfully added "TRADE_REFUNDED" to the database enum.');
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('Enum value "TRADE_REFUNDED" already exists in the database.');
        } else {
            console.error('Error updating enum:', error);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
