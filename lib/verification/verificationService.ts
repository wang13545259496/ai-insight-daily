import type { NewsItem } from "@/types/news";


import {

  verifyNews,

  type VerifyResult

} from "./verifyNews";





export type VerifiedNewsItem =

NewsItem & VerifyResult;









/**
 * 新闻标题标准化
 *
 * 用于判断是否属于同一事件
 */

function normalizeTitle(

title:string

){


return title

.toLowerCase()

.replace(

/[\s\W]/g,

""

);


}









/**
 * 新闻事件分组
 *
 * V7.4.6.4.5
 *
 * 根据标题相似度
 * 聚合同一事件新闻
 */

export function groupNewsByEvent(

news:NewsItem[]

){



const groups:

Record<string,NewsItem[]>

={};





news.forEach(item=>{


const key =

normalizeTitle(

item.title

);





if(!groups[key]){


groups[key]=[];

}


groups[key].push(item);



});





return Object.values(groups);


}









/**
 * 批量真实性核验
 */

export function verifyNewsList(

news:NewsItem[]

):VerifiedNewsItem[]{





if(!news || news.length===0){


return [];

}







/*
=========================
第一步：
事件分组
=========================
*/


const groups =

groupNewsByEvent(news);







const verifiedNews:

VerifiedNewsItem[]

=[];









/*
=========================
第二步：
逐组核验
=========================
*/



groups.forEach(group=>{





group.forEach(item=>{



const result =

verifyNews(item);





verifiedNews.push(result);



});



});









return verifiedNews;


}









/**
 * 真实性统计
 *
 * 提供给 Data Center
 */


export function getVerificationStatistics(

news:VerifiedNewsItem[]

){





const total =

news.length;





const verified =

news.filter(item=>

item.verificationStatus==="verified"

).length;





const warning =

news.filter(item=>

item.verificationStatus==="warning"

).length;





const failed =

news.filter(item=>

item.verificationStatus==="failed"

).length;








return {


total,


verified,


warning,


failed,



verifiedRate:

total===0

?

0

:

Math.round(

verified /

total *

100

)



};



}
export function getAdvancedVerificationStatistics(

news:VerifiedNewsItem[]

){


const total = news.length;



if(total===0){

return {

multiSourceRate:0,

officialRate:0,

mediaConfirmRate:0,

conflictCount:0,

averageConsensus:0

};

}





// 多来源新闻

const multiSource =

news.filter(item=>

item.sourcesChecked>=2

).length;





// 官方来源比例

const official =

news.filter(item=>

item.sourceLevel==="official"

).length;





// 媒体交叉确认

const mediaConfirm =

news.filter(item=>

item.sourcesChecked>=2 &&

item.matchedSources.length>0

).length;





// 存在冲突

const conflict =

news.filter(item=>

item.conflictingSources.length>0

).length;





// 平均一致性

const averageConsensus =

Math.round(

news.reduce(

(sum,item)=>

sum + item.consensusScore,

0

)

/ total

);






return {


multiSourceRate:

Math.round(

multiSource /

total *

100

),



officialRate:

Math.round(

official /

total *

100

),



mediaConfirmRate:

Math.round(

mediaConfirm /

total *

100

),



conflictCount:

conflict,



averageConsensus



};


}