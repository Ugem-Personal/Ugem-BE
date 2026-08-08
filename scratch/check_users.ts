import { prisma } from "../src/config/prisma.js";

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, fullName: true, role: true }
  });
  console.log("Supabase Total Users:", users.length);
  console.table(users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
