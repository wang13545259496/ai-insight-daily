import { analyzeNews } from "@/lib/news/analyzeNews";

async function main() {
  const result = await analyzeNews({
    newsId: 7418,
  });

  console.log(result);
}

main();
