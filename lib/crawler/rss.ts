import Parser from "rss-parser";


const parser = new Parser();



export interface RSSNews {


title:string;


description:string;


link:string;


date:string;


}



export async function fetchRSS(

url:string

):Promise<RSSNews[]>{


try{


const feed = await parser.parseURL(url);



return feed.items.map((item)=>({


title:item.title || "",


description:item.contentSnippet || "",


link:item.link || "",


date:item.pubDate || new Date().toISOString()


}));



}catch(error){


console.error(

"RSS获取失败:",

error

);



return [];


}


}