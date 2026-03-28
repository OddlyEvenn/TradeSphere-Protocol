import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tradeCount = await prisma.trade.count();
    const eventCount = await prisma.tradeEvent.count();
    const trades = await prisma.trade.findMany({ 
        take: 5,
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Current Trade Count: ${tradeCount}`);
    console.log(`Current TradeEvent Count: ${eventCount}`);
    console.log('Last 5 trades:', JSON.stringify(trades, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
