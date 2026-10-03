"use client";

import { useEffect, useState } from "react";



interface NewsScore {

  company: number;

  technology: number;

  market: number;

  startup: number;

  total: number;

}



interface NewsItem {

  title: string;

  time: string;

  background: string;

  content: string;

  impact: string;

  source: string;

  keywords: string[];

  url: string;

  score: NewsScore;

}



interface ApiResponse {

  success: boolean;

  count: number;

  updatedAt: string;

  data: NewsItem[];

}



export default function LiveNews() {


  const [news, setNews] = useState<NewsItem[]>([]);


  const [loading, setLoading] =
    useState(true);


  const [error, setError] =
    useState(false);


  const [updatedAt, setUpdatedAt] =
    useState("");



  async function loadNews() {

    try {

      setLoading(true);

      setError(false);


      const response =
        await fetch("/api/daily", {

          cache: "no-store",

        });


      if (!response.ok) {

        throw new Error(
          "API request failed"
        );

      }


      const result:
        ApiResponse =
        await response.json();


      if (!result.success) {

        throw new Error(
          "News API failed"
        );

      }


      setNews(result.data);


      setUpdatedAt(
        result.updatedAt
      );


    } catch (error) {

      console.error(
        "实时新闻加载失败:",
        error
      );


      setError(true);


    } finally {

      setLoading(false);

    }

  }



  useEffect(() => {

    // react-hooks 规则说明：这里是「挂载后拉取远端数据」的常规写法，
// setState 属于订阅外部系统后的回调，不是渲染期派生状态，故显式豁免。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNews();


    const timer =
      setInterval(

        loadNews,

        5 * 60 * 1000

      );


    return () =>
      clearInterval(timer);


  }, []);



  function formatTime(
    time: string
  ) {

    if (!time) {

      return "";

    }


    const date =
      new Date(time);


    if (Number.isNaN(
      date.getTime()
    )) {

      return time;

    }


    return date.toLocaleString(
      "zh-CN",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );

  }



  return (

    <section className="mt-16">


      <div className="flex justify-between items-end">


        <div>

          <p className="text-sm text-gray-500 uppercase tracking-widest">

            LIVE AI INTELLIGENCE

          </p>


          <h2 className="text-3xl font-bold mt-2">

            实时 AI 热点

          </h2>


          <p className="text-gray-500 mt-2">

            数据来自实时资讯源，由 AI 自动分析与排序

          </p>

        </div>



        {updatedAt && (

          <div className="text-xs text-gray-600">

            更新：

            {formatTime(updatedAt)}

          </div>

        )}

      </div>





      {loading && (

        <div className="
          mt-8
          border
          border-gray-800
          rounded-2xl
          p-8
          text-gray-500
        ">

          正在获取最新 AI 资讯……

        </div>

      )}





      {error && (

        <div className="
          mt-8
          border
          border-gray-800
          rounded-2xl
          p-8
          text-gray-500
        ">

          暂时无法获取实时资讯，请稍后刷新。

        </div>

      )}





      {!loading &&
        !error &&
        news.length === 0 && (

          <div className="
            mt-8
            border
            border-gray-800
            rounded-2xl
            p-8
            text-gray-500
          ">

            当前暂无实时资讯。

          </div>

        )}





      <div className="
        grid
        gap-6
        mt-8
      ">


        {news.map(
          (item, index) => (

            <article

              key={`${item.url}-${index}`}

              className="
                border
                border-gray-800
                rounded-2xl
                p-7
                bg-gray-950
                hover:border-gray-600
                transition
              "

            >


              <div className="
                flex
                justify-between
                items-start
                gap-6
              ">


                <div className="flex-1">


                  <div className="
                    flex
                    flex-wrap
                    items-center
                    gap-3
                  ">


                    <span className="
                      text-xs
                      px-3
                      py-1
                      rounded-full
                      border
                      border-gray-700
                      text-gray-400
                    ">

                      #{index + 1}

                    </span>


                    <span className="
                      text-xs
                      text-gray-500
                    ">

                      {item.source}

                    </span>


                    <span className="
                      text-xs
                      text-gray-600
                    ">

                      {formatTime(
                        item.time
                      )}

                    </span>


                  </div>



                  <h3 className="
                    text-2xl
                    font-bold
                    mt-4
                  ">

                    {item.title}

                  </h3>


                </div>



                {item.score && (

                  <div className="
                    text-right
                    min-w-[90px]
                  ">

                    <div className="
                      text-xs
                      text-gray-600
                    ">

                      AI INDEX

                    </div>


                    <div className="
                      text-3xl
                      font-bold
                      mt-1
                    ">

                      {item.score.total}

                    </div>

                  </div>

                )}

              </div>





              <div className="
                mt-6
                grid
                md:grid-cols-3
                gap-5
              ">


                <div>

                  <p className="
                    text-xs
                    text-gray-600
                    uppercase
                  ">

                    背景

                  </p>


                  <p className="
                    text-gray-400
                    mt-2
                    text-sm
                    leading-relaxed
                  ">

                    {item.background}

                  </p>

                </div>



                <div>

                  <p className="
                    text-xs
                    text-gray-600
                    uppercase
                  ">

                    内容

                  </p>


                  <p className="
                    text-gray-400
                    mt-2
                    text-sm
                    leading-relaxed
                  ">

                    {item.content}

                  </p>

                </div>



                <div>

                  <p className="
                    text-xs
                    text-gray-600
                    uppercase
                  ">

                    AI影响分析

                  </p>


                  <p className="
                    text-gray-400
                    mt-2
                    text-sm
                    leading-relaxed
                  ">

                    {item.impact}

                  </p>

                </div>


              </div>





              <div className="
                flex
                flex-wrap
                justify-between
                items-center
                gap-4
                mt-6
                pt-5
                border-t
                border-gray-900
              ">


                <div className="
                  flex
                  flex-wrap
                  gap-2
                ">


                  {item.keywords
                    .slice(0, 5)
                    .map(
                      (keyword) => (

                        <span

                          key={keyword}

                          className="
                            text-xs
                            px-3
                            py-1
                            rounded-full
                            bg-gray-900
                            border
                            border-gray-800
                            text-gray-500
                          "

                        >

                          #{keyword}

                        </span>

                      )
                    )}

                </div>



                {item.url && (

                  <a

                    href={item.url}

                    target="_blank"

                    rel="noopener noreferrer"

                    className="
                      text-sm
                      text-gray-400
                      hover:text-white
                      transition
                    "

                  >

                    查看原文 →

                  </a>

                )}

              </div>


            </article>

          )
        )}


      </div>


    </section>

  );

}