export interface WebSource {


name:string;


url:string;


keywords:string[];


category:string;


trust:number;


}



export const webSources:WebSource[]=[



{
name:"DeepSeek",
url:"https://www.deepseek.com/",
keywords:[
"DeepSeek",
"模型",
"大模型",
"推理",
"AI"
],
category:"中国AI",
trust:95
},



{
name:"阿里云通义千问",
url:"https://tongyi.aliyun.com/",
keywords:[
"通义千问",
"Qwen",
"模型",
"Agent",
"智能体"
],
category:"中国AI",
trust:95
},



{
name:"腾讯混元",
url:"https://hunyuan.tencent.com/",
keywords:[
"混元",
"腾讯",
"大模型",
"Agent"
],
category:"中国AI",
trust:95
},



{
name:"百度文心",
url:"https://cloud.baidu.com/product/wenxinworkshop",
keywords:[
"文心",
"ERNIE",
"大模型",
"智能体"
],
category:"中国AI",
trust:90
},



{
name:"华为盘古",
url:"https://www.huaweicloud.com/product/modelarts.html",
keywords:[
"盘古",
"华为云",
"大模型",
"AI"
],
category:"中国AI",
trust:90
},



{
name:"字节豆包",
url:"https://www.doubao.com/",
keywords:[
"豆包",
"字节",
"模型",
"Agent"
],
category:"中国AI",
trust:90
},



{
name:"智谱AI",
url:"https://www.zhipuai.cn/",
keywords:[
"智谱",
"GLM",
"大模型",
"Agent"
],
category:"中国AI",
trust:90
},



{
name:"月之暗面Kimi",
url:"https://www.moonshot.cn/",
keywords:[
"Kimi",
"月之暗面",
"长文本",
"模型"
],
category:"中国AI",
trust:90
},



{
name:"MiniMax",
url:"https://www.minimaxi.com/",
keywords:[
"MiniMax",
"模型",
"多模态",
"Agent"
],
category:"中国AI",
trust:90
},



{
name:"阶跃星辰",
url:"https://www.stepfun.com/",
keywords:[
"阶跃星辰",
"Step",
"模型",
"Agent"
],
category:"中国AI",
trust:90
}



];
