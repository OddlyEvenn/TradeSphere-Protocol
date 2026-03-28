import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Database Cleanup Started ---');

  // Migrating users using raw SQL to bypass Prisma type checks for removed enum values
  const updatedCount = await (prisma as any).$executeRawUnsafe(
    `UPDATE "User" SET role = 'CUSTOMS' WHERE role IN ('TAX_AUTHORITY', 'REGULATORS')`
  );

  console.log(`Migrated ${updatedCount} users from obsolete roles (TAX_AUTHORITY, REGULATORS) to CUSTOMS.`);
  console.log('--- Cleanup Complete. Now run: npx prisma db push ---');
}

main()
  .catch((e) => {
    console.error('Cleanup Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
