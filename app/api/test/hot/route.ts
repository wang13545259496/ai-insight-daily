import {
getHotNews
}
from "@/lib/news/getHotNews";


export async function GET(){


const data =
await getHotNews(10);



return Response.json({

success:true,

data

});


}