import { prisma } from "@/lib/prisma";
import { generateDailyReport } from "./generateDailyReport";

export async function saveDailyReport() {
  const report = await generateDailyReport();

  const result = await prisma.dailyReport.upsert({
    where: {
      date: report.date,
    },
    update: {
      title: report.title,
      content: report.content,
    },
    create: {
      title: report.title,
      content: report.content,
      date: report.date,
    },
  });

  return result;
}
