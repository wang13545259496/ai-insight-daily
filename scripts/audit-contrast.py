#!/usr/bin/env python3
"""
按「元素所处背景」修正低对比度文字颜色。

问题背景：
  · 全站有两套主题：深色页（bg-black）与浅色页（bg-white）
  · 即使同一页面内也混用 —— 首页是白底，但首屏是一个 bg-black 的 hero 区
  · 同一个 text-gray-400 在黑底上是 8.27:1（合格），在白底上只有 2.54:1（不合格）
  因此不能按文件整体替换，必须看每处文字实际落在什么背景上。

实测对比度（背景 #000 / #FFF）：
              黑底          白底
  gray-400   8.27 AAA     2.54 ✗
  gray-500   4.34 ✗       4.83 AA
  gray-600   2.78 ✗       7.56 AAA
  gray-700   2.04 ✗      10.31 AAA
  zinc-400   8.19 AAA     2.56 ✗
  zinc-500   4.35 ✗       4.83 AA

替换规则：
  深色背景：gray-500/600/700 → gray-400     zinc-500 → zinc-400
  浅色背景：gray-400         → gray-600     zinc-400/500 → zinc-600

背景判定：
  用 <section> / <div> 标签栈跟踪最近一个带 bg- 类的容器；
  没有则回退到页面根主题（<main className="min-h-screen bg-X">）。

用法：
  python3 scripts/fix-contrast-by-context.py --dry-run   # 预演，只报告
  python3 scripts/fix-contrast-by-context.py             # 实际修改
"""

import re
import sys
from pathlib import Path

ROOT = Path("/home/administrator/projects/ai-insight-daily")

DRY = "--dry-run" in sys.argv

# ---------- 颜色表 ----------
DARK_BG = {"black", "zinc-950", "zinc-900", "gray-950", "gray-900", "neutral-950", "neutral-900"}
LIGHT_BG = {"white", "gray-50", "gray-100", "zinc-50", "zinc-100", "neutral-50"}

# 深色背景上的替换
DARK_MAP = {
    "text-gray-500": "text-gray-400",
    "text-gray-600": "text-gray-400",
    "text-gray-700": "text-gray-400",
    "text-zinc-500": "text-zinc-400",
    "text-zinc-600": "text-zinc-400",
}

# 浅色背景上的替换
LIGHT_MAP = {
    "text-gray-400": "text-gray-600",
    "text-zinc-400": "text-zinc-600",
    "text-zinc-500": "text-zinc-600",
}

BG_RE = re.compile(r"bg-(black|white|zinc-\d{2,3}|gray-\d{2,3}|neutral-\d{2,3})")
TEXT_RE = re.compile(r"text-(gray|zinc|neutral)-(\d{3})")

# 能承载背景的容器标签
CONTAINER_TAGS = ("section", "div", "main", "aside", "article", "header", "footer", "nav")


def root_theme(lines):
    """从文件里找出页面根主题。"""
    for line in lines:
        if "min-h-screen" in line:
            m = BG_RE.search(line)
            if m:
                return "dark" if m.group(1) in DARK_BG else "light"
    # 兜底：统计出现次数
    src = "".join(lines)
    d = sum(len(re.findall(r"bg-" + b, src)) for b in DARK_BG)
    l = sum(len(re.findall(r"bg-" + b, src)) for b in LIGHT_BG)
    return "dark" if d >= l else "light"


def process(path: Path):
    src = path.read_text(encoding="utf-8")
    lines = src.split("\n")

    default_theme = root_theme(lines)

    # 栈：每层记录 (tag, theme)
    stack = []
    changes = []
    out = []

    tag_open = re.compile(r"<(" + "|".join(CONTAINER_TAGS) + r")\b")
    tag_close = re.compile(r"</(" + "|".join(CONTAINER_TAGS) + r")\s*>")

    for lineno, line in enumerate(lines, 1):
        # 0. 注释行原样保留。
        #    Footer.tsx 的注释里明确写了「初版用了 text-gray-500（4.34:1…）」，
        #    那是记录改动原因的关键信息，不能被替换掉。
        stripped = line.strip()
        if stripped.startswith(("*", "//", "/*", "*/")):
            out.append(line)
            continue

        # 1. 这一行是否引入新背景
        bg_theme = None
        for m in BG_RE.finditer(line):
            name = m.group(1)
            if name in DARK_BG:
                bg_theme = "dark"
            elif name in LIGHT_BG:
                bg_theme = "light"
            else:
                # gray-200/300 之类按浅色处理
                bg_theme = "light"

        # 2. 当前生效主题（最近一个带 bg 的容器，否则页面根主题）
        current = default_theme
        for _tag, th in reversed(stack):
            if th:
                current = th
                break

        # 3. 若本行开启容器，先按「本行背景」决定其中内容主题
        opens = list(tag_open.finditer(line))
        closes = list(tag_close.finditer(line))

        if opens and bg_theme:
            # 同一行开了容器且带背景 —— 该行内的文字属于这个新背景
            current = bg_theme

        # 4. 执行替换
        new_line = line

        if current == "dark":
            mapping = DARK_MAP
        else:
            mapping = LIGHT_MAP

        for old, new in mapping.items():
            if old in new_line:
                cnt = new_line.count(old)
                new_line = new_line.replace(old, new)

                # 避免替换刚生成的（如 gray-500→gray-400 后又命中 gray-400→gray-600）
                changes.append((lineno, old, new, cnt, current))

        out.append(new_line)

        # 5. 更新栈：先处理闭合，再处理开启（粗略按行内顺序）
        for _m in closes:
            if stack:
                stack.pop()
        for _m in opens:
            stack.append((_m.group(1), bg_theme))

    return "\n".join(out), changes, default_theme


def main():
    app_only = "--app-only" in sys.argv

    files = sorted((ROOT / "app").rglob("page.tsx"))

    if not app_only:
        files += sorted((ROOT / "components").rglob("*.tsx"))

    total_changes = 0
    touched = 0
    report = []

    for f in files:
        try:
            new_src, changes, theme = process(f)
        except Exception as e:
            print(f"  ✗ {f.relative_to(ROOT)}: {e}")
            continue

        if not changes:
            continue

        touched += 1
        n = sum(c[3] for c in changes)
        total_changes += n

        report.append((str(f.relative_to(ROOT)), theme, n, changes[:3]))

        if not DRY:
            orig = f.read_text(encoding="utf-8")
            if new_src != orig:
                f.write_text(new_src, encoding="utf-8")

    print("=" * 70)
    print("预演结果" if DRY else "已应用")
    print("=" * 70)
    print()

    for rel, theme, n, samples in report:
        print(f"  {rel:44s} {theme:6s} {n:4d} 处")
        for lineno, old, new, cnt, ctx in samples:
            print(f"      L{lineno:<5d} {old} → {new}  ×{cnt}  [{ctx}]")

    print()
    print(f"  涉及文件: {touched} 个")
    print(f"  替换总数: {total_changes} 处")

    if DRY:
        print()
        print("  这是预演，未写入。确认后去掉 --dry-run 执行。")


if __name__ == "__main__":
    main()
