/**
 * 把 PlanDocument 渲染为 .docx。
 *
 * 为什么用 docx 而不是 PDF：中文字体是硬约束 ——
 * 浏览器/PDF 库若要输出中文，必须嵌入 TTF（中文子集通常 10MB 以上）。
 * Word 文档的字体由阅读端提供，因此中文原生可用，依赖体积也小。
 * 用户如需 PDF，用 Word / WPS 直接导出即可。
 *
 * 本文件只做机械映射（结构 → docx 元素），字段取舍逻辑在 export.ts，
 * 那边有单测覆盖；这里保持薄，避免把业务规则混进渲染代码。
 */

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { DocSection, PlanDocument } from "./export";

/** 正文字号（半磅），21 = 10.5pt，与 Word 中文默认字号一致 */
const BODY_SIZE = 21;

/** 小字号（用于说明文字） */
const SMALL_SIZE = 18;

/** 标题字号 */
const TITLE_SIZE = 36;

/** 副标题字号 */
const SUBTITLE_SIZE = 20;

/** 创建普通段落 */
function textParagraph(text: string, options: { size?: number; bold?: boolean; color?: string } = {}) {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({
        text,
        size: options.size ?? BODY_SIZE,
        bold: options.bold,
        color: options.color,
      }),
    ],
  });
}

/** 创建项目符号段落 */
function bulletParagraph(text: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: BODY_SIZE })],
  });
}

/** 创建键值对段落（加粗标签 + 普通值） */
function factParagraph(label: string, value: string) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: `${label}：`, size: BODY_SIZE, bold: true }),
      new TextRun({ text: value, size: BODY_SIZE }),
    ],
  });
}

/** 创建表格单元格 */
function cell(text: string, options: { bold?: boolean; widthPercent?: number } = {}) {
  return new TableCell({
    width: options.widthPercent
      ? { size: options.widthPercent, type: WidthType.PERCENTAGE }
      : undefined,
    children: [
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text, size: SMALL_SIZE, bold: options.bold })],
      }),
    ],
  });
}

/**
 * 创建表格。
 *
 * 列宽：首列固定较窄，其余均分 —— 实测文档里表格列宽不受控时，
 * 「说明」这类长文本列会被挤成一条竖线。
 */
function buildTable(headers: string[], rows: string[][]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => cell(h, { bold: true, widthPercent: i === 0 ? 12 : undefined })),
  });

  const bodyRows = rows.map(
    (r) =>
      new TableRow({
        children: r.map((v, i) => cell(v, { widthPercent: i === 0 ? 12 : undefined })),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });
}

/** 渲染一个区块 */
function renderSection(section: DocSection): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 120 },
      children: [new TextRun({ text: section.title, size: 26, bold: true, color: "1F4E79" })],
    }),
  ];

  for (const p of section.paragraphs ?? []) {
    out.push(textParagraph(p));
  }

  for (const f of section.facts ?? []) {
    out.push(factParagraph(f.label, f.value));
  }

  for (const b of section.bullets ?? []) {
    out.push(bulletParagraph(b));
  }

  if (section.table) {
    // 表格前后各留一个空段，避免与相邻文字贴在一起
    out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
    out.push(buildTable(section.table.headers, section.table.rows));
    out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }

  return out;
}

/**
 * 生成 .docx 二进制。
 *
 * @returns Buffer，可直接作为 HTTP 响应体
 */
export async function renderPlanDocx(doc: PlanDocument): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  // ---------- 标题 ----------
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: doc.header.title, size: TITLE_SIZE, bold: true })],
    }),
  );

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: doc.header.subtitle, size: SUBTITLE_SIZE, color: "595959" })],
    }),
  );

  // ---------- 正文区块 ----------
  for (const section of doc.sections) {
    children.push(...renderSection(section));
  }

  // ---------- 页脚说明 ----------
  children.push(
    new Paragraph({
      spacing: { before: 320 },
      border: { top: { style: "single", size: 4, color: "BFBFBF" } },
      children: [new TextRun({ text: doc.footer, size: SMALL_SIZE, color: "808080" })],
    }),
  );

  const document = new Document({
    creator: "AI Insight Daily",
    title: doc.header.title,
    description: doc.header.subtitle,
    sections: [
      {
        properties: {
          page: {
            // A4 与常规页边距，便于直接打印
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
