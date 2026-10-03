import {
NextResponse
}
from "next/server";


import {
prisma
}
from "@/lib/prisma";




// 添加收藏

export async function POST(

request:Request

){


const body =
await request.json();



const favorite =
await prisma.investmentFavorite.create({

data:{


investmentId:
body.investmentId


}

});



return NextResponse.json(favorite);


}




// 获取收藏列表

export async function GET(){


const favorites =
await prisma.investmentFavorite.findMany({

include:{


Investment:true


},


orderBy:{


createdAt:"desc"


}

});



return NextResponse.json(favorites);


}