export function calculateNewsScore(

importance:number

){


return {


hotScore:importance,


trend:

importance>80

?"热门趋势"

:"普通资讯"


}


}