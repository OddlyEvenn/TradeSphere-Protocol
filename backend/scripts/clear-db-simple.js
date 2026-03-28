const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log('Cleaning...');
  const tables = ['TradeEvent', 'Document', 'CustomsVerification', 'BillOfLading', 'LetterOfCredit', 'MarketplaceOffer', 'MarketplaceListing', 'Trade', 'Product', 'Category'];
  
  for (const table of tables) {
    try {
      await prisma[table.charAt(0).toLowerCase() + table.slice(1)].deleteMany({});
      console.log(`Cleared ${table}`);
    } catch (e) {
      console.log(`Skipped ${table} (already empty or error)`);
    }
  }
  console.log('Done.');
  await prisma.$disconnect();
}

run();
