// Temporary QA helper -- clears today's ChatMessage rows for
// avagoldstein03@gmail.com only, so daily-limit testing isn't blocked by
// messages sent earlier today under a different tier. Not meant to be committed.
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "avagoldstein03@gmail.com" },
    select: { id: true },
  });
  if (!user) { console.log("User not found"); return; }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const result = await prisma.chatMessage.deleteMany({
    where: { userId: user.id, createdAt: { gte: todayStart } },
  });
  console.log(`Deleted ${result.count} messages from today for this account.`);
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
