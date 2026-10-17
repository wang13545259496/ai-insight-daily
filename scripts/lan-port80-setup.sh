#!/bin/bash
# ============================================================
#  局域网访问：让 192.168.1.25（不带端口）能打开站点
#
#  这个脚本在 Windows 侧执行（通过 PowerShell 调用），
#  WSL 里跑不了 netsh。
#
#  背景
#  ----
#  应用监听 3000 端口。手机在局域网里访问 http://192.168.1.25:3000
#  是通的，但直觉上人会直接输 http://192.168.1.25（默认 80 端口），
#  那样连不上——80 上没有任何服务（nginx 已于早前停用）。
#
#  做法
#  ----
#  在 Windows 加一条端口转发 80 → 127.0.0.1:3000。
#  这样局域网里 http://192.168.1.25 就能打开。
#
#  为什么转发到 127.0.0.1 而不是 WSL 的 IP
#  ----
#  本机 WSL2 用的是镜像网络，WSL 里的 0.0.0.0:3000 在 Windows 的
#  127.0.0.1:3000 上可达。用 127.0.0.1 最稳，WSL 换 IP 也不受影响。
#
#  持久性
#  -----
#  portproxy 规则存在注册表
#  HKLM\SYSTEM\CurrentControlSet\Services\PortProxy\v4tov4\tcp
#  重启后仍在。但依赖 iphlpsvc（IP Helper）服务；若该服务被禁用，
#  转发会失效。重装系统、部分 Windows 大版本更新后可能丢失，
#  届时重跑本脚本即可。
# ============================================================
#
#  用法（在 Windows PowerShell 里，需管理员）：
#      netsh interface portproxy add v4tov4 `
#        listenport=80 listenaddress=0.0.0.0 `
#        connectport=3000 connectaddress=127.0.0.1
#
#  查看现有规则：
#      netsh interface portproxy show v4tov4
#
#  撤销：
#      netsh interface portproxy delete v4tov4 `
#        listenport=80 listenaddress=0.0.0.0
# ============================================================

set -u

cat <<'EOF'
此脚本只是说明文件。实际命令由 Windows 侧执行：

  添加（管理员）：
    netsh interface portproxy add v4tov4 listenport=80 listenaddress=0.0.0.0 connectport=3000 connectaddress=127.0.0.1

  查看：
    netsh interface portproxy show v4tov4

  删除：
    netsh interface portproxy delete v4tov4 listenport=80 listenaddress=0.0.0.0

  检查 iphlpsvc（转发的依赖服务）：
    sc query iphlpsvc
EOF
