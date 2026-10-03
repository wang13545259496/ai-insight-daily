import {
NextResponse
}
from "next/server";


import {
prisma
}
from "@/lib/prisma";




export async function GET(){


const data =
await prisma.investment.findMany({

include:{

  InvestmentScore:true,

  InvestmentFavorite:true

}

});



return NextResponse.json(data);


}