import NewsTitle from "@/components/NewsTitle";
import { prisma } from "@/lib/prisma";
import { breakdownScore } from "@/lib/ranking/scoreBreakdown";
import { checkContentQuality } from "@/lib/news/contentQualityScore";

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;
  const newsId = Number(id);

  const news = await prisma.news.findFirst({
    where: {
      id: newsId,
      dataStatus: "active",
    },
  });

  if (!news) {
    return (
      <main className="min-h-screen bg-black text-white px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="border border-gray-800 bg-gray-950 rounded-2xl p-8">
            <p className="text-gray-500">未找到这条新闻。</p>
          </div>
        </div>
      </main>
    );
  }

  const isAnalyzed = news.analysisStatus === "completed";

  const contentQuality =
    checkContentQuality(
      news.content || ""
    );


  const articleContent =
    contentQuality.level === "polluted"
      ? (
          news.summary?.trim() ||
          "该新闻正文质量异常，已自动整理。"
        )
      : (
          news.content?.trim() ||
          news.summary?.trim() ||
          "暂无新闻正文"
        );

  const judgmentContent = buildCoreJudgment(
    news.insight,
    news.summary,
    news.content
  );

  const impactContent = isAnalyzed
    ? splitAnalysisText(news.impact)
    : [];

  const businessContent = isAnalyzed
    ? splitAnalysisText(news.businessOpportunity)
    : [];

  const investmentContent = isAnalyzed
    ? splitAnalysisText(news.investmentView)
    : [];

  const industryValueContent = buildIndustryValue(
    news.insight,
    news.content,
    news.summary
  );

  const riskContent = isAnalyzed
    ? extractRisk(news.investmentView, news.insight, news.businessOpportunity)
    : "暂无风险分析";

  // AI SCORE 拆解：把裸分数解释为可理解的维度
  // 逻辑见 lib/ranking/scoreBreakdown.ts（纯函数，11 项单测）
  const scoreDetail =
    news.aiScore !== null && news.aiScore !== undefined
      ? breakdownScore(news.aiScore, news.title, news.content || "", news.source || "")
      : null;

  return (
    <main className="min-h-screen bg-black text-white px-4 py-8 md:px-8">
      <div className="max-w-6xl mx-auto">

        {/* 01 新闻头部 */}
        <section className="border border-gray-800 bg-gray-950 rounded-3xl overflow-hidden">
          <div className="p-6 md:p-8">

            <div className="flex flex-wrap items-center gap-3 mb-5">
              <span className="text-xs tracking-[0.25em] text-gray-500 uppercase">
                AI资讯
              </span>

              {news.source && (
                <span className="text-xs text-gray-500">
                  {news.source}
                </span>
              )}

              {scoreDetail && (
                <span className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-300">
                  AI评分 {scoreDetail.score} · {scoreDetail.tier.label}
                </span>
              )}
            </div>

            {scoreDetail && (
              <div className="mb-8 border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 px-5 py-3 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">
                      AI SCORE {scoreDetail.score}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-900 text-white">
                      {scoreDetail.tier.label}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">{scoreDetail.tier.meaning}</span>
                </div>

                <div className="divide-y divide-gray-100">
                  {scoreDetail.dimensions.map((dim) => (
                    <div key={dim.name} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-4 mb-1.5">
                        <span className="text-sm text-gray-700">{dim.name}</span>
                        <span className="text-sm font-semibold tabular-nums text-gray-900">
                          {dim.value}
                        </span>
                      </div>
                      <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-1 bg-gray-900 rounded-full"
                          style={{ width: `${Math.min(100, dim.value)}%` }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-gray-500">{dim.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">

              <div className="min-w-0 flex-1">
                <h1 className="text-3xl md:text-5xl font-semibold leading-tight tracking-tight">
                  {/*
                    详情页只显示中文标题，不附英文小字 ——
                    正文与逐字分析就在下方，此处再放一行英文会稀释视觉重心。
                    需要原文的读者可从页面底部的来源链接进入。
                  */}
                  <NewsTitle
                    title={news.title}
                    titleZh={news.titleZh}
                    showOriginal={false}
                  />
                </h1>
              </div>

              {news.sourceUrl && (
                <div className="shrink-0 md:pt-1">
                  <div className="flex flex-col items-start md:items-end gap-2">
                    <a
                      href={news.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 bg-white text-black text-sm font-medium hover:bg-gray-200 transition whitespace-nowrap"
                    >
                      查看原始来源
                      <span>↗</span>
                    </a>

                    <span className="text-[11px] text-gray-600">
                      原始来源可能需要国际网络访问
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!news.sourceUrl && (
              <div className="mt-5">
                <span className="text-xs text-gray-600">
                  暂无原始来源链接
                </span>
              </div>
            )}
          </div>
        </section>

        {/* 02 发生了什么 */}
        <section className="mt-8">
          <div className="mb-4">
            <div className="text-[11px] tracking-[0.3em] text-gray-600 uppercase">
              WHAT HAPPENED
            </div>

            <h2 className="mt-2 text-2xl md:text-3xl font-semibold">
              发生了什么
            </h2>
          </div>

          <div className="border border-gray-800 bg-gray-950 rounded-2xl p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-1 h-6 bg-white rounded-full" />

              <div>
                <h3 className="text-lg font-semibold">
                  新闻正文
                </h3>

                <p className="text-xs text-gray-600 mt-1">
                  本站整理
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {splitArticleText(articleContent).map((paragraph, index) => (
                <p
                  key={index}
                  className="text-[15px] md:text-base leading-8 text-gray-300"
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* 核心判断 */}
          <div className="mt-4 border border-gray-900 bg-gray-950/70 rounded-2xl p-6 md:p-7">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <div className="text-[10px] tracking-[0.25em] text-gray-600 uppercase">
                  CORE JUDGMENT
                </div>

                <h3 className="mt-2 text-lg font-semibold">
                  核心判断
                </h3>
              </div>

              <span className="text-[11px] text-gray-600">
                AI产业视角
              </span>
            </div>

            <p className="text-base md:text-lg leading-8 text-gray-200">
              {judgmentContent}
            </p>
          </div>
        </section>

        {/* 03 为什么重要 */}
        <section className="mt-12">
          <div className="mb-5">
            <div className="text-[11px] tracking-[0.3em] text-gray-600 uppercase">
              WHY IT MATTERS
            </div>

            <h2 className="mt-2 text-2xl md:text-3xl font-semibold">
              为什么重要
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              从产业、商业与投资三个角度理解这条新闻的价值。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard
              title="产业影响"
              label="INDUSTRY"
              content={impactContent}
            />

            <InsightCard
              title="商业机会"
              label="BUSINESS"
              content={businessContent}
            />

            <InsightCard
              title="投资判断"
              label="INVESTMENT"
              content={investmentContent}
            />
          </div>
        </section>

        {/* 04 AI研判 */}
        <section className="mt-12">
          <div className="mb-5">
            <div className="text-[11px] tracking-[0.3em] text-gray-600 uppercase">
              AI INSIGHT
            </div>

            <h2 className="mt-2 text-2xl md:text-3xl font-semibold">
              AI智能分析
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            <ResearchCard
              title="产业价值"
              content={industryValueContent}
            />

            <ResearchCard
              title="商业方向"
              content={
                news.businessOpportunity?.trim() ||
                "暂无商业方向分析"
              }
            />

            <ResearchCard
              title="关注风险"
              content={riskContent}
            />

          </div>
        </section>

      </div>
    </main>
  );
}

function InsightCard({
  title,
  label,
  content,
}: {
  title: string;
  label: string;
  content: string[];
}) {
  return (
    <div className="border border-gray-800 bg-gray-950 rounded-2xl p-6 min-h-[220px]">
      <div className="text-[10px] tracking-[0.25em] text-gray-600">
        {label}
      </div>

      <h3 className="mt-3 text-lg font-semibold">
        {title}
      </h3>

      {content.length > 0 ? (
        <div className="mt-5 space-y-3">
          {content.map((item, index) => (
            <p
              key={index}
              className="text-sm leading-7 text-gray-400"
            >
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-7 text-gray-600">
          暂无相关分析
        </p>
      )}
    </div>
  );
}

function ResearchCard({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  return (
    <div className="border border-gray-800 bg-gray-950 rounded-2xl p-6 min-h-[220px]">
      <div className="text-[10px] tracking-[0.25em] text-gray-600 uppercase">
        AI ANALYSIS
      </div>

      <h3 className="mt-3 text-lg font-semibold">
        {title}
      </h3>

      <p className="mt-5 text-sm leading-7 text-gray-400">
        {content}
      </p>
    </div>
  );
}

function splitArticleText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitAnalysisText(text: string | null) {
  if (!text?.trim()) {
    return [];
  }

  return text
    .replace(/\r\n/g, "\n")
    .split(/\n+|(?<=[。！？])/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCoreJudgment(
  insight: string | null,
  summary: string | null,
  content: string | null
) {
  const insightText = insight?.trim().replace(/\s+/g, " ");

  if (insightText) {
    const sentences = insightText
      .split(/(?<=[。！？])/)
      .map((item) => item.trim())
      .filter(Boolean);

    const judgmentSentence = sentences.find((sentence) =>
      /重塑|意味着|表明|推动|加速|改变|竞争|门槛|趋势|倒逼|催化|深化|转向|普及/.test(
        sentence
      )
    );

    if (judgmentSentence) {
      return simplifyJudgment(judgmentSentence);
    }

    if (sentences.length >= 2) {
      return simplifyJudgment(sentences[sentences.length - 1]);
    }

    return simplifyJudgment(insightText);
  }

  const summaryText = summary?.trim().replace(/\s+/g, " ");

  if (summaryText) {
    const sentences = summaryText
      .split(/(?<=[。！？])/)
      .map((item) => item.trim())
      .filter(Boolean);

    const conclusion = sentences.find((sentence) =>
      /意味着|表明|可能|有望|推动|加速|重塑|改变|降低门槛|提升|强化|加剧|倒逼/.test(
        sentence
      )
    );

    if (conclusion) {
      return simplifyJudgment(conclusion);
    }

    if (sentences.length >= 2) {
      return simplifyJudgment(sentences[sentences.length - 1]);
    }
  }

  if (content?.trim()) {
    const firstSentence = content
      .trim()
      .replace(/\s+/g, " ")
      .split(/(?<=[。！？])/)
      .map((item) => item.trim())
      .filter(Boolean)[0];

    if (firstSentence) {
      return `这条消息的核心价值在于：${firstSentence}`;
    }
  }

  return "暂无核心判断";
}

function buildIndustryValue(
  insight: string | null,
  content: string | null,
  summary: string | null
) {
  const insightText = insight?.trim().replace(/\s+/g, " ");

  if (insightText) {
    const sentences = insightText
      .split(/(?<=[。！？])/)
      .map((item) => item.trim())
      .filter(Boolean);

    const industrySentence = sentences.find((sentence) =>
      /产业|行业|市场|生态|生产力|开发者|企业|应用|模型|平台|成本|价格/.test(
        sentence
      )
    );

    if (industrySentence) {
      const remaining = sentences.filter(
        (sentence) => sentence !== industrySentence
      );

      if (remaining.length > 0) {
        return `${industrySentence} ${remaining.join(" ")}`;
      }

      return industrySentence;
    }
  }

  if (summary?.trim()) {
    return `从产业角度看，这一变化的关键在于：${summary
      .trim()
      .replace(/\s+/g, " ")}`;
  }

  if (content?.trim()) {
    return `从产业角度看，这一事件可能进一步推动相关技术和应用落地。`;
  }

  return "暂无产业价值分析";
}

function extractRisk(
  investmentView: string | null,
  insight: string | null,
  businessOpportunity: string | null
) {
  const investmentText = investmentView?.trim();

  if (investmentText) {
    const riskMatch = investmentText.match(
      /(?:风险|不确定性|挑战|注意|需关注|需要关注)[：:：]?\s*([^。！？]+[。！？]?)/i
    );

    if (riskMatch?.[0]) {
      return riskMatch[0].trim();
    }
  }

  const combinedText = [
    investmentText,
    insight?.trim(),
    businessOpportunity?.trim(),
  ]
    .filter(Boolean)
    .join(" ");

  if (combinedText) {
    if (/价格竞争|价格战|降价/.test(combinedText)) {
      return "需要关注 AI 模型价格竞争加剧带来的利润空间压缩，以及低价策略能否长期维持。";
    }

    if (/迭代|技术/.test(combinedText)) {
      return "需要关注模型技术迭代速度，以及当前能力和成本优势能否持续。";
    }

    if (/依赖|平台/.test(combinedText)) {
      return "需要关注对单一模型或平台的依赖，以及底层能力变化带来的业务风险。";
    }
  }

  return "需要关注模型技术快速迭代、价格竞争加剧以及优势持续性的变化。";
}

function simplifyJudgment(text: string) {
  let result = text
    .replace(/^其/, "这一变化")
    .replace(/^该模型/, "这一变化")
    .replace(/^该产品/, "这一变化")
    .replace(/^该公司/, "这一变化")
    .trim();

  if (result.length > 120) {
    result = `${result.slice(0, 120)}……`;
  }

  return result;
}
