import {
  fetchAllSources
} from "./index";



export async function fetchNews() {


  // 多源采集

  const news = await fetchAllSources();


  // 返回原始新闻数据

  return news;


}