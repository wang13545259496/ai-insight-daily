"use client";

import Link from "next/link";


const categories = [

  "全部",
  "AI模型",
  "大模型",
  "Agent",
  "机器人",
  "AI创业",
  "行业动态"

];



export default function CategoryFilter(){


  return (

    <div className="category-filter">


      {
        categories.map(category=>(


          <Link

            key={category}

            href={
              category==="全部"
              ?
              "/"
              :
              `/?category=${category}`
            }

          >

            {category}

          </Link>


        ))

      }


    </div>

  );


}