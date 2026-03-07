const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Starting trade/wallet sync...");
    const MY_METAMASK = "0x8b949eFE4D80d5Ac5561A7547C3ca8a05fB66a36";

    // 1. Find or create a user with this wallet
    let user = await prisma.user.findUnique({ where: { walletAddress: MY_METAMASK } });
    if (!user) {
        // Find any user and hijack their wallet, or create one
        const anyUser = await prisma.user.findFirst();
        if (anyUser) {
            user = await prisma.user.update({
                where: { id: anyUser.id },
                data: { walletAddress: MY_METAMASK }
            });
            console.log(`Updated user ${user.email} to wallet ${MY_METAMASK}`);
        } else {
            console.log("No users found to sync.");
            return;
        }
    }

    // 2. Update the latest trade to use this user for EVERYTHING
    const latestTrade = await prisma.trade.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    if (latestTrade) {
        await prisma.trade.update({
            where: { id: latestTrade.id },
            data: {
                importerId: user.id,
                exporterId: user.id,
                // If we want to test bank roles too, we might need other users? 
                // But for now, let's fix the exporter/importer mismatch
            }
        });
        console.log(`Updated trade ${latestTrade.id} participants to ${user.id} (${MY_METAMASK})`);
    } else {
        console.log("No trades found to sync.");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
