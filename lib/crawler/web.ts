export interface WebNews {

title:string;

description:string;

url:string;

date:string;

}



export async function fetchWeb(

url:string

):Promise<WebNews[]>{


return [];

}
