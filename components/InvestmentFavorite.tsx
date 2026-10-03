"use client";


import {
useState
}
from "react";



export default function InvestmentFavorite({

investmentId

}:{

investmentId:number;

}){


const [saved,setSaved]=useState(false);



async function favorite(){


await fetch(

"/api/investment/favorite",

{

method:"POST",

headers:{

"Content-Type":"application/json"

},

body:JSON.stringify({

investmentId

})

}

);



setSaved(true);


}




return (

<button

onClick={favorite}

className="
border
border-gray-700
px-5
py-2
rounded
hover:bg-white
hover:text-black
"

>

{

saved

?

"⭐ 已收藏"

:

"☆ 收藏项目"

}


</button>


);


}