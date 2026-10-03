import { calculateAIIndex } from "./aiDynamicEngine";





export type AIIndexRecord = {


date:string;


value:number;


};







export function createAIIndexRecord(){



const result = calculateAIIndex();



return {


date:

new Date().toISOString().split("T")[0],


value:

result.value


};


}







export const aiIndexHistoryStore:AIIndexRecord[] = [



{


date:"2026-09-20",

value:91


},



{


date:"2026-09-21",

value:93


},



{


date:"2026-09-22",

value:95


},



{


date:"2026-09-23",

value:createAIIndexRecord().value


}



];