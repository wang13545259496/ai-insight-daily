import {
generateDailyBriefing
}
from "../lib/briefing/generateDailyBriefing"



async function main(){


const result =
await generateDailyBriefing()



console.log(
"AI每日事件简报生成完成"
)


console.log(result)


}


main()