import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    console.log("Checking Prisma Models for TradeSphere:");
    const tradeKeys = Object.keys(prisma).filter(k => !k.startsWith("_"));
    console.log("Found Models:", tradeKeys);
    if (tradeKeys.includes("trade")) {
        console.log("✅ Model 'trade' is accessible!");
    } else {
        console.error("❌ Model 'trade' NOT found!");
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
