/**
 * 本站是否允许搜索引擎收录。
 *
 * ## 当前值：false（不收录）
 *
 * 原因：尚未完成 ICP 备案，运营主体与合规状态未定。
 * 搜索引擎收录**不可逆**（缓存、镜像、Wayback 存档会长期留存），
 * 而 noindex 只是请求，随时可撤。所以先选保守一侧，保留选择权。
 *
 * ## 怎么改成允许收录
 *
 * 把下面这一行改成 `true`，然后：
 *
 *   npm run build && pm2 restart ai-insight-daily
 *
 * 三处会一起变化，不需要改别的地方：
 *
 *   app/robots.ts     robots.txt 的 Allow / Disallow
 *   app/layout.tsx    页面 <meta name="robots">
 *   next.config.ts    X-Robots-Tag 响应头
 *
 * ## 为什么用常量而不是环境变量
 *
 * 最初写成了 `SITE_ALLOW_INDEX` 环境变量，实测出问题：
 *
 *   · robots.txt 是静态路由，构建时就把值烤进去了
 *   · 首页是动态渲染，metadata 在**请求时**读 process.env
 *
 * 于是「重新构建但 PM2 进程环境里还留着旧变量」时，
 * robots.txt 显示 Disallow，而页面 meta 却是 index, follow —— 半状态。
 * 而且 PM2 的 `--update-env` 清不掉它内部状态里的变量，很难排查。
 *
 * 常量的值会被打包成字面量，构建期与运行期必然一致，没有这个缝隙。
 *
 * ## 这不是保密
 *
 * noindex 只是请求搜索引擎不要收录，不是访问控制。
 * 知道域名的人照样能访问。要真正私密需要鉴权（如 Cloudflare Access）。
 */
export const SITE_ALLOW_INDEX = false;
