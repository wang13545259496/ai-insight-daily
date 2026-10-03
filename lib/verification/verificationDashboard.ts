import type { NewsItem } from "@/types/news";


import {

verifyNewsList,

getVerificationStatistics,

getAdvancedVerificationStatistics,

type VerifiedNewsItem

} from "./verificationService";






export function buildVerificationDashboard(

news:NewsItem[]

){



const verifiedNews:

VerifiedNewsItem[]

=

verifyNewsList(news);





const statistics =

getVerificationStatistics(

verifiedNews

);





const advancedStatistics =

getAdvancedVerificationStatistics(

verifiedNews

);






return {


statistics,


advancedStatistics,


news:verifiedNews,


generatedAt:

new Date().toISOString()



};



}