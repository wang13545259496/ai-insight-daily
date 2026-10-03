import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


export async function GET(
request:Request
){


const {searchParams}
=
new URL(request.url);



const keyword =
searchParams.get("q");



if(!keyword){

return NextResponse.json({

success:false,

message:"请输入搜索关键词"

});

}





const news =
await prisma.news.findMany({

where:{

OR:[

{
title:{
contains:keyword
}
},

{
summary:{
contains:keyword
}
},

{
content:{
contains:keyword
}
}

]

},


take:20,


orderBy:{

createdAt:"desc"

}

});






const events =
await prisma.newsEvent.findMany({

where:{

OR:[

{
title:{
contains:keyword
}
},

{
keywords:{
contains:keyword
}
},

{
summary:{
contains:keyword
}
}

]

},


take:10,


orderBy:{

heatScore:"desc"

}

});





return NextResponse.json({

success:true,


keyword,


events,


news

});


}