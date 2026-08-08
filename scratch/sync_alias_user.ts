import { prisma } from "../src/config/prisma.js";

async function main() {
  const original = await prisma.user.findUnique({
    where: { email: "liendtse180143@fpt.edu.vn" }
  });

  if (original) {
    console.log("Found original user:", original.email);
    const aliasEmail = "liendtle180143@fpt.edu.vn";
    const existingAlias = await prisma.user.findUnique({ where: { email: aliasEmail } });
    if (!existingAlias) {
      await prisma.user.create({
        data: {
          email: aliasEmail,
          passwordHash: original.passwordHash,
          fullName: original.fullName,
          phoneNumber: "0987654329",
          role: original.role,
          isActive: true,
          customer: { create: {} }
        }
      });
      console.log("Created alias user:", aliasEmail);
    } else {
      await prisma.user.update({
        where: { email: aliasEmail },
        data: { passwordHash: original.passwordHash }
      });
      console.log("Updated alias user password hash to match original.");
    }
  } else {
    console.log("Original user not found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
