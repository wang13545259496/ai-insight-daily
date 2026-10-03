import crypto from "crypto";



export function createNewsHash(
title:string
){


const text =
title

.toLowerCase()

.replace(
/[^a-z0-9\u4e00-\u9fa5]/g,
""
)

.trim();



return crypto
.createHash("md5")
.update(text)
.digest("hex");


}