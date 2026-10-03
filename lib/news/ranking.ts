export interface NewsRanking {

    hotScore:number;

    impactScore:number;

    freshnessScore:number;

    verificationScore:number;

    finalScore:number;

}



export function calculateNewsRanking(data:{


    views:number;

    likes:number;

    comments:number;

    freshness:number;

    verification:number;

    impact:number;


}):NewsRanking{


    // 热度指数

    const hotScore =
        data.views * 0.5 +
        data.likes * 0.3 +
        data.comments * 0.2;



    // 时间新鲜度

    const freshnessScore =
        data.freshness;



    // 真实性

    const verificationScore =
        data.verification;



    // 行业影响

    const impactScore =
        data.impact;



    const finalScore =

        hotScore * 0.35 +

        freshnessScore * 0.20 +

        verificationScore * 0.25 +

        impactScore * 0.20;



    return {


        hotScore:Number(
            hotScore.toFixed(1)
        ),


        impactScore,


        freshnessScore,


        verificationScore,


        finalScore:Number(
            finalScore.toFixed(1)
        )


    };


}