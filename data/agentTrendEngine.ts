/**
 * Agent趋势预测引擎
 *
 * 用于分析：
 * 1. 当前市场热度
 * 2. 增长速度
 * 3. 技术能力
 * 4. 生态规模
 *
 * 输出：
 * Agent未来趋势指数
 */


export interface AgentTrendInput {


    // 当前热度指数
    hot:number;


    // 增长速度指数
    growth:number;


    // 综合能力评分
    score:number;


    // 生态能力指数
    ecosystem:number;


}





/**
 * 计算Agent趋势指数
 *
 * 权重：
 *
 * 热度        35%
 * 增长速度    25%
 * 能力评分    20%
 * 生态能力    20%
 *
 */


export function calculateAgentTrend({


    hot,

    growth,

    score,

    ecosystem


}:AgentTrendInput){



    const trendValue = Math.round(


        hot * 0.35 +

        growth * 0.25 +

        score * 0.20 +

        ecosystem * 0.20


    );



    return trendValue;


}








/**
 * 根据趋势指数判断状态
 */


export function getAgentTrendStatus(

    value:number

){



    if(value >= 90){


        return {


            trend:"🚀 高速增长",


            direction:"up",


            desc:"未来市场关注度预计持续提升"


        }


    }






    if(value >=75){


        return {


            trend:"📈 稳定增长",


            direction:"up",


            desc:"生态发展保持积极趋势"


        }


    }







    if(value >=60){


        return {


            trend:"➡️ 平稳发展",


            direction:"stable",


            desc:"市场保持正常变化"


        }


    }






    return {


        trend:"📉 调整阶段",


        direction:"down",


        desc:"需要持续观察市场变化"


    }



}