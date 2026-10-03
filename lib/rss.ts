import Parser from "rss-parser";
import { sources } from "../config/sources";


const parser = new Parser();



export interface RSSNews {

  title:string;

  link:string;

  pubDate:string;

  source:string;

  category?:string;

  content?:string;

  summary?:string;

  sourceUrl?:string;

  createdAt?:Date;

}



export async function fetchRSSNews(){


  const results:RSSNews[] = [];



  for(const source of sources){


    if(source.type !== "rss"){

      continue;

    }



    try{


      const feed = await parser.parseURL(source.url);



      feed.items.slice(0,5).forEach(item=>{


        results.push({

          title:item.title || "",

          link:item.link || "",

          pubDate:item.pubDate || "",

          source:source.name,

          category:source.category

        });


      });



    }catch(error){


      console.log(
        `RSS读取失败:${source.name}`,
        error
      );


    }


  }



  return results;


}