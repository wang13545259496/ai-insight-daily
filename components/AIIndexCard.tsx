interface Props{


    title:string;


    value:number;


    desc:string;


}



export default function AIIndexCard({

    title,

    value,

    desc

}:Props){


    return (


        <div className="
            border
            border-gray-800
            rounded-xl
            p-6
        ">



            <div className="
                text-gray-400
                text-sm
            ">

                {title}

            </div>



            <div className="
                text-5xl
                font-bold
                mt-4
            ">

                {value}

            </div>



            <div className="
                mt-3
                text-gray-400
            ">

                {desc}

            </div>


        </div>


    );


}