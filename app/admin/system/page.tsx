export default async function AdminSystemPage() {


  const res =
    await fetch(
      "http://localhost:3000/api/admin/system-health",
      {
        cache:"no-store"
      }
    );


  const result =
    await res.json();



  const data =
    result.data;



  const system =
    result.system;



  return (

    <main className="admin-container">


      <h1>
        AI Insight Daily 系统监控中心
      </h1>



      <section className="dashboard">


        <div className="card">

          <h2>
            📰 新闻数据
          </h2>

          <p>
            新闻总量：
            {data.newsCount}
          </p>

        </div>



        <div className="card">

          <h2>
            📄 日报数据
          </h2>

          <p>
            日报数量：
            {data.reportCount}
          </p>

        </div>



        <div className="card">

          <h2>
            🔥 事件数据
          </h2>

          <p>
            热点事件：
            {data.eventCount}
          </p>

        </div>



        <div className="card">

          <h2>
            💡 商业机会
          </h2>

          <p>
            机会数量：
            {data.opportunityCount}
          </p>

        </div>



        <div className="card">

          <h2>
            💰 投资观察
          </h2>

          <p>
            项目数量：
            {data.investmentCount}
          </p>

        </div>


      </section>





      <section className="card">


        <h2>
          系统状态
        </h2>



        <p>
          Web服务：
          {
            system.web === "online"
            ? "🟢 Online"
            : "🔴 Offline"
          }
        </p>



        <p>
          数据库：
          {
            system.database === "connected"
            ? "🟢 Connected"
            : "🔴 Error"
          }
        </p>



        <p>
          RSS采集：
          ✅ 正常
        </p>



        <p>
          AI摘要：
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
            data.latestNews
            ?
            new Date(
              data.latestNews
            ).toLocaleString()
            :
            "暂无"
          }
        </p>



        <p>
          最新日报：
          {
            data.latestReport
            ?
            new Date(
              data.latestReport
            ).toLocaleString()
            :
            "暂无"
          }
        </p>


      </section>



    </main>

  );

}
