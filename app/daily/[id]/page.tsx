import { prisma } from "@/lib/prisma";

export default async function DailyDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  const report = await prisma.dailyReport.findUnique({
    where: {
      id: Number(id),
    },
  });

  if (!report) {
    return (
      <main
        className="
                min-h-screen
                bg-black
                text-white
                p-10
                "
      >
        日报不存在
      </main>
    );
  }

  return (
    <main
      className="
            min-h-screen
            bg-black
            text-white
            max-w-4xl
            mx-auto
            px-8
            py-16
            "
    >
      <h1
        className="
                text-4xl
                font-bold
                "
      >
        {report.title}
      </h1>

      <p
        className="
                mt-4
                text-gray-500
                "
      >
        {String(report.date)}
      </p>

      <article
        className="
                mt-10
                whitespace-pre-line
                text-gray-300
                leading-8
                "
      >
        {report.content}
      </article>
    </main>
  );
}
