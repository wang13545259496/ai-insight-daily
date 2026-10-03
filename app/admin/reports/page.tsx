import { prisma } from "@/lib/prisma";


export default async function AdminReportsPage(){


  const reports =
    await prisma.dailyReport.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:30

    });



  return (

    <main className="admin-container">


      <h1>
        日报管理
      </h1>



      {

        reports.map(report=>(


          <article
            key={report.id}
            className="report-card"
          >


            <h2>
              {report.title}
            </h2>



            <p>

              日期：

              {report.date}

            </p>



            <div>

              {report.content}

            </div>



            <hr/>


          </article>


        ))

      }


    </main>

  );


}