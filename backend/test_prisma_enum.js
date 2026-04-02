const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
console.log('TradeStatus enum values:', Object.keys(prisma.TradeStatus || {}));
process.exit(0);
