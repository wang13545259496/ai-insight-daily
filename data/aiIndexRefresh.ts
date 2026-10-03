export const aiIndexRefresh = {


lastUpdate:

"2026-09-23 10:00",



previousValue:

88,



currentValue:

92,



change:

4,



trend:

"up",



refreshInterval:

"24小时",



description:

"AI指数根据资讯热度、模型能力、Agent生态和创业活跃度动态更新。"



};





export function getAIIndexChange(){


const change =

aiIndexRefresh.currentValue -

aiIndexRefresh.previousValue;



return {


change,


direction:

change > 0

?

"上涨"

:

change < 0

?

"下降"

:

"保持稳定"



};


}