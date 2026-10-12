export function cleanContent(html:string){

    if(!html){
        return "";
    }


    let text = html;


    // 删除 script
    text = text.replace(
        /<script[\s\S]*?<\/script>/gi,
        ""
    );


    // 删除 style
    text = text.replace(
        /<style[\s\S]*?<\/style>/gi,
        ""
    );


    // 删除图片
    text = text.replace(
        /<img[^>]*>/gi,
        ""
    );


    // 删除 JS 自执行代码
    text = text.replace(
        /\(function[\s\S]*?\}\)\(.*?\);?/gi,
        ""
    );


    // 删除常见 JS 污染
    text = text.replace(
        /(window\.|document\.|gtag\(|collectEvent|dataLayer|function\s*\()/gi,
        ""
    );


    // 删除 JSON-LD
    text = text.replace(
        /\{["@']@context[\s\S]*?\}/gi,
        ""
    );


    // 删除 HTML 标签
    text = text.replace(
        /<[^>]+>/g,
        ""
    );


    // HTML实体
    text = text.replace(/&nbsp;/g," ");
    text = text.replace(/&amp;/g,"&");
    text = text.replace(/&lt;/g,"<");
    text = text.replace(/&gt;/g,">");


    // 空白整理
    text = text.replace(
        /\s+/g,
        " "
    );


    return text.trim();

}





export function isBadContent(text:string){

    if(!text){
        return true;
    }


    // 太短
    if(text.length < 80){
        return true;
    }



    const badWords=[

        "关于我们",
        "加入我们",
        "联系我们",
        "投资者关系",
        "下载",
        "扫码下载",
        "京ICP备",
        "版权所有",
        "客服热线",
        "意见反馈"

    ];



    let count=0;


    for(const word of badWords){

        if(text.includes(word)){
            count++;
        }

    }



    return count>=3;

}
