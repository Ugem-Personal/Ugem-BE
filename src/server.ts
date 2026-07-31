import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";

const startServer = async () => {
  try {
    await prisma.$connect();

    console.log("Đã kết nối database");

    const server = app.listen(env.PORT, () => {
      console.log(`UGem Backend chạy tại http://localhost:${env.PORT}`);
    });

    const shutdown = async () => {
      console.log("Đang dừng server...");

      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Không thể khởi động server:", error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

void startServer();
