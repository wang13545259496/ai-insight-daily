import Link from "next/link";


interface RecommendItem {


    id:number;


    title:string;


    summary:string;


    source:string;


    hotScore?:{

        finalScore:number;

    };


    recommendScore:number;


}



export default function RecommendNews({

    news

}:{

    news:RecommendItem[]

}){


    return (

        <section className="max-w-6xl mx-auto px-8 py-12">


            <div className="mb-8">


                <h2 className="text-3xl font-bold">

                    AI 智能推荐

                </h2>


                <p className="text-gray-400 mt-2">

                    基于新闻热度、趋势变化和AI算法综合推荐

                </p>


            </div>




            <div className="grid md:grid-cols-2 gap-6">



                {news.map(item=>(


                    <Link

                        key={item.id}

                        href={`/news/${item.id}`}

                        className="
                        border
                        border-gray-800
                        rounded-xl
                        p-6
                        hover:border-white
                        transition
                        "


                    >


                        <h3 className="text-xl font-semibold mb-3">

                            {item.title}

                        </h3>



                        <p className="text-gray-400 text-sm mb-4">

                            {item.summary}

                        </p>




                        <div className="flex justify-between text-sm text-gray-400">


                            <span>

                                来源：
                                {item.source}

                            </span>


                            <span>

                                AI评分：
                                {item.recommendScore.toFixed(1)}

                            </span>


                        </div>



                    </Link>


                ))}



            </div>



        </section>

    );

}