import { ApplicationStatus } from "../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { importApplicationMenusAsFoods } from "../modules/applications/application-menu-import.js";

async function run() {
  const applications = await prisma.application.findMany({
    where: {
      status: ApplicationStatus.Accepted,
      applicant: {
        merchant: {
          isNot: null,
        },
      },
    },
    include: {
      menus: true,
      applicant: {
        include: {
          merchant: true,
        },
      },
    },
  });

  let importedCount = 0;

  for (const application of applications) {
    const merchantId = application.applicant.merchant?.id;
    if (!merchantId) continue;

    importedCount += await prisma.$transaction((transaction) =>
      importApplicationMenusAsFoods(transaction, merchantId, application.menus),
    );
  }

  console.log(
    `Đã đồng bộ ${importedCount} món từ ${applications.length} hồ sơ đã duyệt.`,
  );
}

run()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
