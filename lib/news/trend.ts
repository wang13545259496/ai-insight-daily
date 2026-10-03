export type TrendLevel =
    
    | "爆发增长"
    | "上升趋势"
    | "稳定趋势"
    | "热度下降";



export interface TrendResult {


    growth:number;


    level:TrendLevel;


    prediction:string;


}



export function calculateTrend(data:{


    current:number;


    previous:number;


}) : TrendResult {



    if(data.previous===0){


        return {

            growth:100,

            level:"爆发增长",

            prediction:"新兴热点，持续观察"

        };


    }



    const growth =


        (

            (data.current-data.previous)

            /

            data.previous

        )

        *

        100;



    let level:TrendLevel;



    let prediction:string;



    if(growth>=50){


        level="爆发增长";

        prediction="未来24小时可能持续升温";


    }

    else if(growth>=15){


        level="上升趋势";

        prediction="关注后续发展";


    }

    else if(growth>=-15){


        level="稳定趋势";

        prediction="保持当前热度";


    }

    else{


        level="热度下降";

        prediction="关注是否出现反转";


    }



    return {


        growth:Number(

            growth.toFixed(2)

        ),


        level,


        prediction


    };


}