interface DuplicateNews {
  title:string;
}
export function removeDuplicateNews(

newsList:DuplicateNews[]

){



const result:DuplicateNews[]=[];


const titles =
new Set();



for(

const news of newsList

){


const key =
news.title.trim();



if(

!titles.has(key)

){


titles.add(key);


result.push(news);


}


}



return result;


}