export interface NewsItem {

  // 新闻唯一ID
  id: string;


  // 新闻标题
  title: string;


  // 来源渠道
  source: string;


  // 发布时间
  time: string;


  // 新闻背景
  background: string;


  // 新闻正文内容
  content: string;


  // 原始链接
  url: string;


  // 新闻分类
  category: string;



  // =========================
  // V7.4.6.3 真实性核验字段
  // =========================


  // 是否通过真实性核验
  verified?: boolean;


  // 可信度评分 0-100
  trustScore?: number;


  // 核验状态
  verificationStatus?:
    | "verified"
    | "warning"
    | "failed";


  // 核验依据说明
  reasons?: string[];


  // 风险标记
  riskFlags?: string[];


  // =========================
  // 后续 V7.4.6.4 多源交叉验证预留
  // =========================


  // 已检查来源数量
  sourcesChecked?: number;


  // 匹配成功的来源
  matchedSources?: string[];


  // 存在冲突的来源
  conflictingSources?: string[];

}