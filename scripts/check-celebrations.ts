import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const events = await prisma.celebrationEvent.findMany({
    orderBy: { firedAt: 'desc' },
    take: 5,
    select: { id: true, celebrationId: true, celebrationLabel: true, firedAt: true, studentId: true }
  });
  console.log("Recent CelebrationEvents:");
  for (const e of events) {
    console.log(`  ${e.firedAt.toISOString()} | id=${e.celebrationId} | label="${e.celebrationLabel}" | student=${e.studentId ?? 'none'}`);
  }
  const total = await prisma.celebrationEvent.count();
  console.log(`\nTotal events: ${total}`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
