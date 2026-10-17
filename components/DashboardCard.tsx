interface CardProps{


    title:string;


    value:string | number;


    desc:string;


}



export default function DashboardCard({

    title,

    value,

    desc

}:CardProps){



    return (


        <div className="
            border
            border-gray-800
            rounded-xl
            p-6
            bg-black
        ">


            <h3 className="
                text-gray-400
                text-sm
            ">

                {title}

            </h3>



            <div className="
                text-4xl
                font-bold
                mt-3
            ">

                {value}

            </div>



            <p className="
                mt-3
                text-gray-400
                text-sm
            ">

                {desc}

            </p>


        </div>


    );

}