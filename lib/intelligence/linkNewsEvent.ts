import { prisma } from "@/lib/prisma";



function matchScore(
  title:string,
  event:string,
  keywords:string
){

  const text =
    (
      title +
      keywords
    )
    .toLowerCase();



  const words =
    event
    .toLowerCase()
    .split("");



  let count = 0;



  for(const word of words){

    if(
      text.includes(word)
    ){

      count++;

    }

  }



  return count / words.length;

}





export async function linkNewsEvents(){



  const newsList =
    await prisma.news.findMany({

      where:{
        eventId:null
      },

      take:500

    });




  const events =
    await prisma.newsEvent.findMany();




  let linked = 0;




  for(const news of newsList){



    let bestEvent = null;

    let bestScore = 0;



    for(const event of events){



      const score =
        matchScore(
          news.title,
          event.title,
          event.keywords
        );



      if(
        score > bestScore
      ){

        bestScore = score;

        bestEvent = event;

      }


    }




    if(
      bestEvent &&
      bestScore > 0.2
    ){



      await prisma.news.update({

        where:{
          id:news.id
        },

        data:{
          eventId:bestEvent.id
        }

      });



      linked++;


    }


  }



  return {

    linked

  };


}