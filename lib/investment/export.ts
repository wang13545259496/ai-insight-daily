export interface InvestmentReport {
  overview: string;
  business: string;
  technology: string;
  market: string;
  growth: string;
  risk: string;
  summary: string;
}

export function generateMarkdownReport(
  title: string,
  report: InvestmentReport,
): string {
  return `# ${title}

## 一、项目概览

${report.overview}

## 二、商业模式分析

${report.business}

## 三、技术竞争力分析

${report.technology}

## 四、市场空间分析

${report.market}

## 五、成长趋势分析

${report.growth}

## 六、风险因素分析

${report.risk}

## 七、AI投资总结

${report.summary}
`;
}
