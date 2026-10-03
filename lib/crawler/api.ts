export interface APINews {


title:string;


description:string;


url:string;


date:string;


}




export async function fetchAPI(

url:string

):Promise<APINews[]>{


return [


{

title:"API AI资讯",

description:
`来自接口 ${url} 的数据`,

url,

date:
new Date().toISOString()

}


];


}