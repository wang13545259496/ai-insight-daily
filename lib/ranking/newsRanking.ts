export function rankNews(news: any[]) {
  return news
    .map((item) => ({
      ...item,

      rankingScore: Math.round(
        (item.sourceCount || 1) * 20 +
          (item.verified ? 40 : 0) +
          (Date.now() - new Date(item.createdAt).getTime() < 86400000
            ? 20
            : 10),
      ),
    }))

    .sort((a, b) => b.rankingScore - a.rankingScore);
}
