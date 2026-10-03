/**
 * Agent商业价值评分引擎
 *
 * 用于评估：
 *
 * 1. 市场需求
 * 2. 用户增长
 * 3. 商业场景
 * 4. 竞争壁垒
 *
 * 输出：
 * Agent商业价值指数
 */



export interface AgentBusinessInput {


    // 市场需求
    demand:number;


    // 用户增长
    growth:number;


    // 商业应用场景
    application:number;


    // 技术竞争壁垒
    barrier:number;


}





/**
 * 计算商业价值指数
 *
 * 权重：
 *
 * 市场需求 30%
 * 用户增长 25%
 * 商业场景 25%
 * 竞争壁垒 20%
 */


export function calculateAgentBusinessValue({

    demand,

    growth,

    application,

    barrier


}:AgentBusinessInput){



    const value = Math.round(


        demand * 0.3 +

        growth * 0.25 +

        application * 0.25 +

        barrier * 0.2


    );



    return value;


}







/**
 * 商业价值等级
 */


export function getBusinessLevel(

value:number

){



    if(value >=90){


        return {


            level:"★★★★★ 高商业潜力",

            color:"text-white",

            desc:"具备较强市场机会和商业落地空间"


        }


    }





    if(value >=75){


        return {


            level:"★★★★ 商业机会明显",

            color:"text-gray-300",

            desc:"具有持续发展的商业可能"


        }


    }







    if(value >=60){


        return {


            level:"★★★ 观察机会",

            color:"text-gray-400",

            desc:"需要进一步验证市场需求"


        }


    }






    return {


        level:"低商业价值",

        color:"text-gray-500",

        desc:"当前商业机会有限"


    }



}