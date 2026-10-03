import { prisma } from "@/lib/prisma";


export default async function AdminNewsPage(){


  const news =
    await prisma.news.findMany({

      orderBy:{
        createdAt:"desc"
      },

      take:50

    });



  return (

    <main className="admin-container">


      <h1>
        新闻管理
      </h1>



      <div>


        {
          news.map(item=>(


            <div
              key={item.id}
              className="admin-news-card"
            >


              <h2>
                {item.title}
              </h2>



              <p>
                分类：
                {item.category}
              </p>



              <p>
                来源：
                {item.source}
              </p>



              <p>
                摘要：
                {item.summary}
              </p>



              <p>

                状态：

                {
                  item.verified
                  ?
                  "已验证"
                  :
                  "未验证"
                }

              </p>

<div>


<form
action={`/api/admin/news/${item.id}`}
method="POST"
>


<button>
删除
</button>


</form>


</div>

              <hr/>


            </div>


          ))

        }


      </div>


    </main>

  );


}