import bcrypt from "bcrypt";
import { prisma } from "../src/config/prisma.js";

async function main() {
  const email = "liendtle180143@fpt.edu.vn";
  const password = "UGemUat12345!"; // or password chosen by user
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists.`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: "Lien DTL",
      phoneNumber: "0987654321",
      role: "Customer",
      isActive: true,
      customer: {
        create: {}
      }
    }
  });

  console.log("Successfully created user:", user.email, "Password:", password);
}

main().catch(console.error).finally(() => prisma.$disconnect());
