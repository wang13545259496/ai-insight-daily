export interface HotScore {


    views:number;


    engagement:number;


    shareScore:number;


    finalScore:number;


}



export function calculateHotScore(data:{


    views:number;


    likes:number;


    favorites:number;


    shares:number;


    comments:number;


}):HotScore {



    const engagement =

        data.likes * 2 +

        data.favorites * 3 +

        data.comments * 2;



    const shareScore =

        data.shares * 5;



    const finalScore =


        data.views * 0.4 +

        engagement * 0.3 +

        shareScore * 0.3;



    return {


        views:data.views,


        engagement,


        shareScore,


        finalScore:Number(

            finalScore.toFixed(2)

        )


    };


}