import {

fetchNews

}

from "@/lib/crawler/fetchNews";



export async function GET(){



const news = await fetchNews();



return Response.json({

count:news.length,

data:news

});


}