#!/bin/bash
set -u
cd "$HOME/projects/ai-insight-daily" || exit 1

echo "########## 令牌删除检查 ##########"
echo ""

echo "=== 1. 刚才用的那个 DNS token 是否还有效 ==="
node -e "
const TOKEN = process.env.CF_TOKEN;
if (!TOKEN) { console.log('  未提供 token'); process.exit(0); }
(async () => {
  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/zones?name=aibiliai.com', {
      headers: { Authorization: 'Bearer ' + TOKEN },
    });
    const j = await res.json();
    if (j.success) {
      console.log('  ✗ 仍然有效 —— 你删的不是这个（或删除未生效）');
    } else {
      const code = j.errors && j.errors[0] ? j.errors[0].code : '?';
      const msg = j.errors && j.errors[0] ? j.errors[0].message : '';
      if (code === 9109 || code === 1000) {
        console.log('  ✓ 已失效（code ' + code + ': ' + msg + '）');
        console.log('    → 你删掉的正是刚才建的那个 DNS token');
      } else {
        console.log('  ? 返回错误 code=' + code + ' ' + msg);
      }
    }
  } catch (e) {
    console.log('  ? 请求异常: ' + String(e.message).slice(0, 80));
  }
})();
" 2>&1 | sed 's/^/  /'

echo ""
echo "=== 2. 隧道是否仍然连通（与 API token 无关）==="
A=$(systemctl is-active cloudflared-ipv4 2>/dev/null); A=${A:-"-"}
echo "  服务状态: $A"
echo "  进程:"
ps aux 2>/dev/null | grep '[c]loudflared.*tunnel run' | awk '{print "    PID " $2 "  启动 " $9}'
echo ""
echo "  最近连接记录:"
journalctl -u cloudflared-ipv4 --no-pager 2>/dev/null \
  | grep 'Registered tunnel connection' | tail -2 \
  | grep -oE 'connIndex=[0-9].*location=[a-z0-9]+.*protocol=[a-z0-9]+' | sed 's/^/    /'

echo ""
echo "  最近 5 分钟隧道错误数:"
journalctl -u cloudflared-ipv4 --since '5 min ago' --no-pager 2>/dev/null \
  | grep -cE 'Connection terminated|Retrying|write udp' | sed 's/^/    /'

echo ""
echo "=== 3. 站点是否正常 ==="
for i in 1 2 3; do
  C=$(curl -4 -s -o /dev/null --max-time 15 -w '%{http_code}' https://aibiliai.com/)
  echo "  第 $i 次: $C"
done

echo ""
echo "=== 4. 隧道 token 文件是否存在（这个不能删）==="
if [ -r /etc/cloudflared/token ]; then
  echo "  ✓ /etc/cloudflared/token 存在且可读"
elif [ -e /etc/cloudflared/token ]; then
  echo "  ✓ /etc/cloudflared/token 存在（权限受限，属正常）"
else
  echo "  ✗ 文件不存在 —— 这才会有问题"
fi

echo ""
echo "=== 5. 关键区别说明 ==="
echo "  · API Token（你刚建的）：只用于调 Cloudflare API 改 DNS 等"
echo "    删掉它不影响网站运行"
echo "  · 隧道 Token（/etc/cloudflared/token）：cloudflared 连 Cloudflare 用"
echo "    这个是本地文件，后台删除令牌列表里看不到"
