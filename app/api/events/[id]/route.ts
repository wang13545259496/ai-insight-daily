import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";


export async function GET(

request:Request,

{
params
}:{
params:Promise<{id:string}>
}

){


const {id}=await params;


const event =
await prisma.newsEvent.findUnique({

where:{
id:Number(id)
},


include:{

news:true

}

});



if(!event){

return NextResponse.json({

success:false,

message:"事件不存在"

},{
status:404
});

}



return NextResponse.json({

success:true,

data:event

});


}