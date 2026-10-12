export function cleanContent(html: string) {

    if (!html) {
        return "";
    }

    let text = String(html);


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


    // 删除 HTML 注释
    text = text.replace(
        /<!--[\s\S]*?-->/g,
        ""
    );


    // 删除 JSON-LD
    text = text.replace(
        /\{["@']@context[\s\S]*?\}/gi,
        ""
    );


    // 删除 JS 初始化代码
    text = text.replace(
        /\(function[\s\S]*?\}\)\(.*?\);?/gi,
        ""
    );


    text = text.replace(
        /(window\.|document\.|gtag\(|collectEvent|dataLayer|function\s*\()/gi,
        ""
    );


    // 删除 HTML 标签
    text = text.replace(
        /<[^>]+>/g,
        ""
    );


    // HTML实体处理
    text = text.replace(/&nbsp;/g, " ");
    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");


    // 空白整理
    text = text.replace(
        /\s+/g,
        " "
    );


    return text.trim();

}



export function isBadContent(text: string) {

    if (!text) {
        return true;
    }


    const content = text.toLowerCase();



    /*
      前端构建产物 / JS bundle 污染
    */

    const codePatterns = [

        "gfdatav1",

        "_modernjs_route_manifest",

        "chunkids",

        "routeassets",

        "runtime\":\"node",

        "runtime\":\"",

        "webpack",

        "__next",

        "sourcemappingurl",

        "javascript:",

        "typeof window",

        "performance.setresourcetimingbuffersize",

        "canarytype",

        "envname"

    ];



    let codeCount = 0;


    for (const word of codePatterns) {

        if (content.includes(word)) {
            codeCount++;
        }

    }


    if (codeCount >= 2) {
        return true;
    }




    /*
      官网页面源码污染
      例如：
      华为云产品页
      阿里云产品页
      官网落地页
    */

    const pageSourcePatterns = [

        "@media",

        "display:none",

        "footer",

        "header",

        "csslist",

        "siteinfo",

        "aiocdn",

        "cnpm-pep",

        "component",

        "res.hc-cdn.com",

        "cdn",

        "static/",

        "assets/"

    ];


    let pageCount = 0;


    for (const word of pageSourcePatterns) {

        if (content.includes(word)) {
            pageCount++;
        }

    }


    if (pageCount >= 3) {
        return true;
    }




    /*
      官网导航页 / 营销页误抓
    */

    const badWords = [

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


    let count = 0;


    for (const word of badWords) {

        if (text.includes(word)) {
            count++;
        }

    }


    if (count >= 3) {
        return true;
    }




    /*
      大量代码符号
    */

    const symbolRate =
        (text.match(/[{}[\]();_=]/g) || []).length /
        text.length;


    if (
        symbolRate > 0.08 &&
        text.length > 200
    ) {
        return true;
    }



    /*
      明显无效正文
    */

    const invalidPatterns = [

        "no content",

        "暂无内容",

        "read more",

        "click here",

        "本站整理"

    ];


    for (const word of invalidPatterns) {

        if (
            content === word ||
            content.startsWith(word)
        ) {
            return true;
        }

    }



    /*
      正文过短
    */

    if (text.length < 30) {
        return true;
    }



    return false;

}
