export interface WebNews {


title:string;


description:string;


url:string;


date:string;


}



export async function fetchWeb(

url:string

):Promise<WebNews[]>{


return [


{

title:"网页AI资讯",

description:
`来自 ${url} 的AI动态`,

url,

date:
new Date().toISOString()

}


];


}