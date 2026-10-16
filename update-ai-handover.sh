#!/bin/bash
#
# 生成 AI-HANDOVER 交接包。
#
# 用途：把「让另一个 AI（或未来的自己）理解这个项目」所需的文件打成一个 zip，
# 供无法直接访问仓库的场景使用（例如纯网页会话里上传）。
#
# 设计说明（2026-10-16 重写）：
#
# 1. **按规则收集，不再硬编码清单。**
#    旧版只拷贝 ai-context/、package.json、prisma/schema.prisma、README.md，
#    导致新增的根目录文档（AI-START-HERE.md）不在包里，
#    而 RECOVERY.md 只是某次手动放进目录的残留 —— 旧版第一步就是
#    rm -rf AI-HANDOVER，一跑就会把它清掉。
#
# 2. **不依赖当前工作目录。** 旧版用 PROJECT_DIR=$(pwd)，
#    从别处执行会把 pwd 当成项目目录，而脚本里有 rm -rf，
#    存在误删风险。现改为固定路径并加校验。
#
# 3. **记录 git 版本。** 交接包里写入生成时的 commit 号，
#    便于日后判断这份包比代码落后多少。

set -u

PROJECT_DIR="$HOME/projects/ai-insight-daily"
STAGE="$PROJECT_DIR/AI-HANDOVER"
ZIP="$PROJECT_DIR/AI-HANDOVER.zip"

# ---------- 安全校验：确认路径正确再动手 ----------
if [ ! -f "$PROJECT_DIR/package.json" ]; then
  echo "✗ 项目目录不正确：$PROJECT_DIR"
  exit 1
fi

if [ "$STAGE" = "/" ] || [ -z "$STAGE" ]; then
  echo "✗ 暂存路径异常，已中止"
  exit 1
fi

cd "$PROJECT_DIR" || exit 1

echo "=============================="
echo "生成 AI-HANDOVER 交接包"
echo "=============================="
echo ""

# ---------- 清理 ----------
rm -rf "$STAGE"
rm -f "$ZIP"
mkdir -p "$STAGE"

COPIED=0
copy() {
  local src="$1"
  if [ -e "$src" ]; then
    mkdir -p "$STAGE/$(dirname "$src")"
    cp -r "$src" "$STAGE/$src"
    COPIED=$((COPIED + 1))
    echo "  ✓ $src"
  else
    echo "  ✗ 缺失: $src"
  fi
}

# ---------- 1. AI 文档目录 ----------
echo "[1/5] AI 交接文档（整个目录）"
copy "ai-context"
echo ""

# ---------- 2. 根目录的 Markdown 文档 ----------
# 按规则收集而非逐个列举 —— 以后新增根目录文档会自动被包含
echo "[2/5] 根目录文档（自动收集 *.md）"
for f in *.md; do
  [ -f "$f" ] || continue
  copy "$f"
done
echo ""

# ---------- 3. 运维脚本 ----------
echo "[3/5] 运维脚本（scripts 下的 .sh 与备份/恢复相关）"
if [ -d scripts ]; then
  for f in scripts/*.sh; do
    [ -f "$f" ] || continue
    copy "$f"
  done
  # 数据库备份脚本（.ts 与 .cjs 也一并带上，恢复时可能用到）
  for f in scripts/*.ts; do
    case "$(basename "$f")" in
      backup*|restore*|db-*) copy "$f" ;;
    esac
  done
fi
# 项目根目录的维护脚本
for f in *.sh; do
  [ -f "$f" ] || continue
  copy "$f"
done
echo ""

# ---------- 4. 项目核心文件 ----------
# 注意：AGENTS.md 已在第 2 步按 *.md 规则收集过，此处不重复拷贝
echo "[4/5] 项目核心文件"
copy "package.json"
copy "package-lock.json"
copy "prisma/schema.prisma"
copy "next.config.ts"
copy "tsconfig.json"
echo ""

# ---------- 5. 版本信息 ----------
echo "[5/5] 写入版本信息"
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "未知")
COMMIT_DATE=$(git log -1 --format=%cd --date=short 2>/dev/null || echo "未知")
GENERATED=$(date '+%Y-%m-%d %H:%M:%S')

cat > "$STAGE/HANDOVER-VERSION.txt" <<VERSIONEOF
AI-HANDOVER 交接包

生成时间：$GENERATED
对应 commit：$COMMIT（$COMMIT_DATE）
分支：$(git branch --show-current 2>/dev/null || echo "未知")

内容说明
--------
ai-context/       AI 交接文档体系（含主索引、架构、部署、数据库、故障排查）
AI-START-HERE.md  维护入口：改动流程、验证要求、已知问题、沟通约定
RECOVERY.md       电脑损坏后重建站点的完整步骤
scripts/          运维脚本（数据库备份、部署等）
其他              根目录文档、package.json、prisma schema、AGENTS.md

使用建议
--------
若接收方无法访问代码仓库，让它先读 AI-START-HERE.md，
再按其中的指引表读其余文档。

注意：本包**不含数据库**。数据库备份在仓库的 db-backup 分支，
恢复方法见 RECOVERY.md。
VERSIONEOF

echo "  ✓ HANDOVER-VERSION.txt（commit $COMMIT）"
echo ""

# ---------- 打包 ----------
echo "打包..."
zip -r "$ZIP" AI-HANDOVER > /dev/null 2>&1

if [ ! -f "$ZIP" ]; then
  echo "✗ 打包失败"
  exit 1
fi

echo ""
echo "=============================="
echo "完成"
echo "=============================="
echo ""
echo "  文件数（不含压缩包）：$((COPIED + 1))"
echo "  压缩包大小：$(du -h "$ZIP" | cut -f1)"
echo "  位置：$ZIP"
echo ""
echo "  包内文件清单："
unzip -l "$ZIP" 2>/dev/null | awk '$4 != "" && $4 !~ /\/$/ {print "    " $4}' | head -60
