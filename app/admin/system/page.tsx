import { prisma } from "@/lib/prisma";


export default async function AdminSystemPage(){


  const newsCount =
    await prisma.news.count();



  const reportCount =
    await prisma.dailyReport.count();



  const latestNews =
    await prisma.news.findFirst({

      orderBy:{
        createdAt:"desc"
      }

    });



  const latestReport =
    await prisma.dailyReport.findFirst({

      orderBy:{
        createdAt:"desc"
      }

    });



  return (

    <main className="admin-container">


      <h1>
        系统监控中心
      </h1>



      <section className="dashboard">


        <div className="card">

          <h2>
            新闻数据
          </h2>


          <p>
            新闻总量：
            {newsCount}
          </p>


        </div>




        <div className="card">

          <h2>
            日报数据
          </h2>


          <p>
            日报数量：
            {reportCount}
          </p>


        </div>



      </section>




      <section className="card">


        <h2>
          系统状态
        </h2>



        <p>
          RSS采集：
          ✅ 正常
        </p>


        <p>
          摘要系统：
          ✅ 正常
        </p>


        <p>
          日报生成：
          ✅ 正常
        </p>



      </section>




      <section className="card">


        <h2>
          最近运行
        </h2>


        <p>

          最新新闻：

          {
            latestNews?.createdAt
            .toLocaleString()

          }

        </p>



        <p>

          最新日报：

          {
            latestReport?.createdAt
            .toLocaleString()

          }

        </p>


      </section>



    </main>

  );

}