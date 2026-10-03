import { createAIIndexRecord } from "./aiIndexHistoryStore";

import { aiIndexHistoryStore } from "./aiIndexHistoryStore";



export function recordTodayAIIndex(){



const today = 
new Date()
.toISOString()
.split("T")[0];





const exists = aiIndexHistoryStore.find(

(item)=>
item.date===today

);





if(exists){

return aiIndexHistoryStore;

}







const record = createAIIndexRecord();





aiIndexHistoryStore.push(record);





return aiIndexHistoryStore;



}