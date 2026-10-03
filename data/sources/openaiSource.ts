/**
 * OpenAI 新闻源
 *
 * V7.2.1
 *
 * 数据来源：
 * OpenAI 官方新闻
 *
 * 后续可接入：
 * RSS
 * API
 * 定时任务
 */


import { NewsItem } from "@/types/news";





export const openaiSource:NewsItem[] = [



{


id:"openai-001",


title:
"OpenAI 发布最新人工智能技术进展",


source:
"OpenAI",


time:
"2026-09-23",



background:
"OpenAI持续推进大模型、Agent以及人工智能应用生态发展。",



content:
"该新闻展示OpenAI在模型能力、开发者生态和企业应用方向的最新进展。",



url:
"https://openai.com/news/",



category:
"模型"


},





{


id:"openai-002",


title:
"OpenAI 推进 AI Agent 生态建设",


source:
"OpenAI",


time:
"2026-09-23",



background:
"AI Agent正在成为下一阶段人工智能应用的重要方向。",



content:
"OpenAI持续探索智能体能力，包括工具调用、任务执行和企业应用场景。",



url:
"https://openai.com/news/",



category:
"Agent"


},





{


id:"openai-003",


title:
"OpenAI 开发者生态持续扩展",


source:
"OpenAI",


time:
"2026-09-23",



background:
"开发者生态是人工智能商业化的重要基础。",



content:
"OpenAI通过API、开发工具和平台能力支持开发者构建AI应用。",



url:
"https://developers.openai.com/blog/",



category:
"开发者生态"


}


];