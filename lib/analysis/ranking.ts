import {

calculateNewsScore

}

from "./newsScore";





export interface RankableNews {
  source:string;
  title:string;
  content:string;
}
export function rankNews(

newsList:RankableNews[]

){



return newsList

.map(news=>({


...news,


score:

calculateNewsScore(news)


}))


.sort(

(a,b)=>

b.score.total -

a.score.total

);



}