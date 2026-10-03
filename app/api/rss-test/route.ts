import { fetchRSSNews } from "@/lib/rss";


export async function GET(){


  const news = await fetchRSSNews();



  return Response.json({

    count:news.length,

    data:news

  });


}