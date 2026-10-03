import { prisma } from "@/lib/prisma";


export default async function AdminPage(){


  const newsCount =
    await prisma.news.count();



  const reportCount =
    await prisma.dailyReport.count();



  const latestNews =
    await prisma.news.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:5

    });



  return (

    <main className="admin-container">


      <h1>
        AI Insight Daily 管理后台
      </h1>



      <section className="stats">


        <div className="card">

          <h2>
            新闻数量
          </h2>

          <p>
            {newsCount}
          </p>

        </div>



        <div className="card">

          <h2>
            日报数量
          </h2>

          <p>
            {reportCount}
          </p>

        </div>


      </section>




      <section>


        <h2>
          最新新闻
        </h2>



        {

          latestNews.map(item=>(


            <div
              key={item.id}
              className="news-item"
            >

              <h3>
                {item.title}
              </h3>


              <p>
                来源：
                {item.source}
              </p>


            </div>


          ))

        }


      </section>



    </main>

  );


}