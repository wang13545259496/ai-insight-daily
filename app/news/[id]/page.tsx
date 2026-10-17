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
      <main className="min-h-screen bg-white px-4 py-12 text-black">
        <div className="mx-auto max-w-4xl">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8">
            <p className="text-gray-700">未找到这条新闻。</p>
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

  /**
   * 正文区块的来源说明。
   *
   * 未分析的记录只能显示抓取到的原文（arXiv 摘要等），
   * 若仍标「本站整理」就是虚假声明 —— 读者会以为内容经过编辑加工。
   */
  const articleSourceLabel = isAnalyzed
    ? "本站整理"
    : "原始抓取内容，未经整理";


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

  /**
   * 核心判断与产业价值也必须判 isAnalyzed。
   *
   * 这两个函数内部都有「insight 为空时退到 summary/content」的兜底。
   * 对已分析的记录这是合理的（summary 是模型整理的）；
   * 但对未分析的记录（analysisStatus = pending），会把**原始正文**
   * 拼进「这条消息的核心价值在于：…」这种句式 ——
   * 读者会以为那是 AI 分析，实际是没处理过的论文摘要。
   *
   * 实测 69 条 pending 记录的 summary 就是 arXiv 原始摘要
   *（含「arXiv:2610.19210v1 Announce Type: new Abstract:」元信息），
   * 在页面上被当作分析结论展示。
   *
   * 因此这里与下方 impact / businessOpportunity / investmentView
   * 的处理保持一致：未分析就不生成，由渲染层显示占位文案。
   */
  const judgmentContent = isAnalyzed
    ? buildCoreJudgment(news.insight, news.summary, news.content)
    : "";

  const impactContent = isAnalyzed
    ? splitAnalysisText(news.impact)
    : [];

  const businessContent = isAnalyzed
    ? splitAnalysisText(news.businessOpportunity)
    : [];

  const investmentContent = isAnalyzed
    ? splitAnalysisText(news.investmentView)
    : [];

  const industryValueContent = isAnalyzed
    ? buildIndustryValue(news.insight, news.content, news.summary)
    : "";

  // extractRisk 在三个字段全空时仍会返回一句通用风险提示（见该函数末尾），
  // 对未分析的记录同样属于无中生有，故保持原有守卫。
  const riskContent = isAnalyzed
    ? extractRisk(news.investmentView, news.insight, news.businessOpportunity)
    : "暂无风险分析";

  // AI SCORE 拆解：把裸分数解释为可理解的维度
  // 逻辑见 lib/ranking/scoreBreakdown.ts（纯函数，11 项单测）
  /**
   * AI 评分只在分析完成后展示。
   *
   * 判据必须包含 isAnalyzed：pending 记录的 aiScore 是 0 而非 null，
   * 仅判断非空会让未分析的记录也渲染出「AI评分 0 · 低」，
   * 0 分会被误读为「这条新闻价值极低」，实际是「还没评」。
   */
  const scoreDetail =
    isAnalyzed && news.aiScore !== null && news.aiScore !== undefined
      ? breakdownScore(news.aiScore, news.title, news.content || "", news.source || "")
      : null;

  /** 发布时间的可读形式；无有效日期时不显示，避免出现 Invalid Date */
  const publishedLabel = (() => {
    const raw = news.publishedAt ?? news.createdAt;

    if (!raw) return null;

    const d = new Date(raw);

    if (Number.isNaN(d.getTime())) return null;

    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();

  const paragraphs = splitArticleText(articleContent);

  return (
    <main className="min-h-screen bg-white text-black px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* 顶部信息条 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gray-200 pb-5 text-sm">
          <span className="font-bold tracking-[0.2em] text-gray-900 uppercase">
            AI资讯
          </span>

          {news.source && (
            <>
              <span className="text-gray-300">·</span>
              <span className="font-medium text-gray-700">{news.source}</span>
            </>
          )}

          {publishedLabel && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-gray-600">{publishedLabel}</span>
            </>
          )}

          {scoreDetail && (
            <span className="ml-auto rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white">
              AI评分 {scoreDetail.score} · {scoreDetail.tier.label}
            </span>
          )}
        </div>

        {/* 标题区 */}
        <header className="mt-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <h1 className="min-w-0 flex-1 text-3xl leading-tight font-bold tracking-tight text-black md:text-4xl lg:text-[2.75rem]">
              {/*
                详情页只显示中文标题，不附英文小字 ——
                正文与逐条分析就在下方，此处再放一行英文会稀释视觉重心。
                需要原文的读者可从右侧来源按钮进入。
              */}
              <NewsTitle
                title={news.title}
                titleZh={news.titleZh}
                showOriginal={false}
              />
            </h1>

            {news.sourceUrl && (
              <div className="shrink-0 lg:pt-2">
                <a
                  href={news.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
                >
                  查看原始来源
                  <span aria-hidden>↗</span>
                </a>

                <p className="mt-2 text-xs text-gray-500">
                  原始来源可能需要国际网络访问
                </p>
              </div>
            )}
          </div>
        </header>

        {/* 主体：大屏两栏 */}
        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">

          {/* 左栏：正文与分析 */}
          <div className="lg:col-span-8">

            {/* 02 发生了什么 */}
            <section>
              <SectionHeading en="WHAT HAPPENED" zh="发生了什么" />

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 md:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="h-6 w-1 rounded-full bg-black" />

                  <div>
                    <h3 className="text-lg font-bold text-black">
                      {isAnalyzed ? "新闻正文" : "原始摘要"}
                    </h3>

                    <p className="mt-0.5 text-xs text-gray-500">
                      {articleSourceLabel}
                    </p>
                  </div>
                </div>

                <div className="max-w-[68ch] space-y-4">
                  {paragraphs.map((paragraph, index) => (
                    <p
                      key={index}
                      className="text-base leading-8 text-gray-800"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            </section>

            {/* AI 生成内容标识 —— 位于所有 AI 分析内容之前 */}
            <div className="mt-10 rounded-xl border border-gray-300 bg-gray-50 px-5 py-4">
              <p className="text-sm leading-7 text-gray-600">
                <span className="rounded bg-black px-2 py-0.5 text-[10px] font-bold text-white">
                  AI 生成
                </span>
                <span className="ml-2 font-bold text-gray-900">
                  以下内容由人工智能模型生成，未经人工编辑审核。
                </span>
                可能存在错误或偏差，仅供参考，
                <span className="text-gray-900">不构成投资建议</span>。
                事实信息请以正文与原始来源为准。
              </p>
            </div>

            {/* 核心判断 */}
            <section className="mt-8">
              <SectionHeading en="CORE JUDGMENT" zh="核心判断" note="AI生成 · 产业视角" />

              <div className="mt-6 border-l-4 border-black pl-6">
                <p className="text-lg leading-9 font-medium text-gray-900">
                  {judgmentContent || PENDING_ANALYSIS_TEXT}
                </p>
              </div>
            </section>

            {/* 03 为什么重要 */}
            <section className="mt-14">
              <SectionHeading
                en="WHY IT MATTERS"
                zh="为什么重要"
                note="AI生成 · 从产业、商业与投资三个角度理解"
              />

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <InsightCard title="产业影响" label="INDUSTRY" content={impactContent} />
                <InsightCard title="商业机会" label="BUSINESS" content={businessContent} />
                <InsightCard title="投资判断" label="INVESTMENT" content={investmentContent} />
              </div>
            </section>

            {/* 04 AI研判 */}
            <section className="mt-14">
              <SectionHeading en="AI INSIGHT" zh="AI智能分析" note="AI生成 · 未经人工审核" />

              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                <ResearchCard title="产业价值" content={industryValueContent} />
                <ResearchCard
                  title="商业方向"
                  content={
                    isAnalyzed
                      ? news.businessOpportunity?.trim() || PENDING_ANALYSIS_TEXT
                      : PENDING_ANALYSIS_TEXT
                  }
                />
                <ResearchCard title="关注风险" content={riskContent} />
              </div>
            </section>
          </div>

          {/* 右栏：评分与风险（大屏粘性跟随） */}
          <aside className="lg:col-span-4">
            <div className="space-y-6 lg:sticky lg:top-8">

              {scoreDetail ? (
                <div className="overflow-hidden rounded-2xl border border-gray-200">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-900 px-5 py-3">
                    <span className="text-sm font-bold text-white">
                      AI SCORE {scoreDetail.score}
                    </span>

                    <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-gray-900">
                      {scoreDetail.tier.label}
                    </span>
                  </div>

                  <p className="border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs text-gray-600">
                    {scoreDetail.tier.meaning}
                  </p>

                  <div className="divide-y divide-gray-100">
                    {scoreDetail.dimensions.map((dim) => (
                      <div key={dim.name} className="px-5 py-3.5">
                        <div className="mb-2 flex items-center justify-between gap-4">
                          <span className="text-sm text-gray-700">{dim.name}</span>

                          <span className="text-sm font-bold tabular-nums text-black">
                            {dim.value}
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-black"
                            style={{ width: `${Math.min(100, dim.value)}%` }}
                          />
                        </div>

                        <p className="mt-2 text-xs leading-5 text-gray-500">
                          {dim.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm text-gray-600">{PENDING_ANALYSIS_TEXT}</p>
                </div>
              )}

              {/* 关注风险固定放侧栏：它是读者决策前最需要先看到的一条 */}
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                <div className="text-[10px] font-bold tracking-[0.25em] text-gray-500 uppercase">
                  RISK
                </div>

                <h3 className="mt-2 text-base font-bold text-black">关注风险</h3>

                <p className="mt-3 text-sm leading-7 text-gray-700">
                  {riskContent}
                </p>
              </div>

            </div>
          </aside>
        </div>


      </div>
    </main>
  );
}

/**
 * 区块标题：英文小标 + 中文主标题 + 可选说明。
 *
 * 原先四处区块各自手写这三段，样式不完全一致；
 * 抽成组件后统一对比度 —— 原 text-gray-600 在白底上偏淡，改为 gray-500/900。
 */
function SectionHeading({
  en,
  zh,
  note,
}: {
  en: string;
  zh: string;
  note?: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-bold tracking-[0.3em] text-gray-500 uppercase">
        {en}
      </div>

      <h2 className="mt-2 text-2xl font-bold text-black md:text-3xl">{zh}</h2>

      {note && <p className="mt-2 text-sm text-gray-600">{note}</p>}
    </div>
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
    <div className="flex min-h-[220px] flex-col rounded-2xl border border-gray-200 bg-gray-50 p-6">
      <div className="text-[10px] font-bold tracking-[0.25em] text-gray-500">
        {label}
      </div>

      <h3 className="mt-2.5 text-lg font-bold text-black">{title}</h3>

      {content.length > 0 ? (
        <div className="mt-4 space-y-3">
          {content.map((item, index) => (
            <p key={index} className="text-sm leading-7 text-gray-700">
              {item}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm leading-7 text-gray-500">
          {PENDING_ANALYSIS_TEXT}
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
    <div className="flex min-h-[220px] flex-col rounded-2xl border border-gray-200 bg-gray-50 p-6">
      <div className="text-[10px] font-bold tracking-[0.25em] text-gray-500 uppercase">
        AI ANALYSIS
      </div>

      <h3 className="mt-2.5 text-lg font-bold text-black">{title}</h3>

      <p className="mt-4 text-sm leading-7 text-gray-700">
        {content || PENDING_ANALYSIS_TEXT}
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

/**
 * 未生成 AI 分析时的占位文案。
 *
 * 刻意不用「暂无相关分析」这类模糊说法 —— 读者需要知道
 * 是**还没分析**，而不是分析了但没有相关内容。两者的可信度不同。
 */
const PENDING_ANALYSIS_TEXT = "该条尚未生成 AI 分析，稍后会自动补全。";

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
