/**
 * 旅行模块的一次性邀请码。
 *
 * ## 为什么需要
 *
 * 原先只有一个共享口令 TRAVEL_PASSWORD。给了朋友之后会有两个问题：
 *   · 口令可以无限转发，转发给谁你都不知道
 *   · 所有人共用一个身份，查不出是谁在用、也做不了行程隔离
 *
 * 一次性码解决第一点：码被兑换后立即作废，转发出去也没用。
 * 每个码兑换出一个独立的 grantId，解决第二点。
 *
 * ## 存储
 *
 * 只存码的 SHA-256，不存明文。理由是数据库泄露时明文码可直接登录 ——
 * 码只在生成那一刻展示一次，之后服务端只需要「算哈希 → 查表」。
 *
 * ## 原子消费
 *
 * 用带条件的 `updateMany` 而不是「先查再改」：
 *
 *   UPDATE TravelInvite SET usedAt=now() WHERE codeHash=? AND usedAt IS NULL AND expiresAt>now()
 *
 * 影响行数为 1 才算抢到。两个人同时提交同一个码时，只有一个人能成功 ——
 * 「先 findUnique 再 update」的写法在并发下会让两人都通过。
 */

import { prisma } from "./prisma";

/**
 * 码的字符集。
 *
 * 排除了 0/O、1/I/L 这些手写和口述时容易混的字符，
 * 剩下 31 个。8 位约 8.5e11 种组合，猜不出来。
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** 码的随机段长度 */
const CODE_LENGTH = 8;

/** 展示用前缀。参与哈希，避免与其它用途的哈希撞车 */
const CODE_PREFIX = "TRV";

/** 默认有效期（天）。控制「未使用的码何时作废」 */
export const DEFAULT_INVITE_DAYS = 1;

/**
 * 每个邀请码允许生成的行程次数。
 *
 * 跟着码走、不重置：用完就要新码。
 * 改这个值只影响之后的判断，不会追溯已经用掉的量。
 */
export const INVITE_GENERATION_LIMIT = 10;

/** 额度查询/消耗的结果 */
export interface QuotaResult {
  allowed: boolean;
  used: number;
  limit: number;
}

/**
 * 额度用尽时的提示文案。
 *
 * 与「频率限制」的措辞刻意不同：这里不是「稍后再试」，
 * 而是**这个码的额度永久用完了** —— 等多久都不会恢复。
 * 如果写成「请 X 分钟后再试」，用户会一直重试。
 */
export function quotaExceededMessage(limit: number = INVITE_GENERATION_LIMIT): string {
  return `本次邀请码的 ${limit} 次生成额度已用完，需要更多请找维护者要新码。`;
}

/**
 * 查询某身份已用掉的额度。
 *
 * @returns 找不到该身份时 used 为 0（例如维护者没有对应的邀请码记录）
 */
export async function getInviteQuota(
  grantId: string,
  limit: number = INVITE_GENERATION_LIMIT,
): Promise<QuotaResult> {
  const row = await prisma.travelInvite.findUnique({
    where: { grantId },
    select: { generations: true },
  });

  const used = row?.generations ?? 0;

  return { allowed: used < limit, used, limit };
}

/**
 * 消耗一次生成额度。
 *
 * 用条件自增而不是「先查再改」：两个请求同时到达时，
 * 只有第一个能让 `generations < limit` 成立，第二个影响行数为 0。
 *
 * @param grantId 身份标识（对应 TravelInvite.grantId）
 */
export async function consumeInviteQuota(
  grantId: string,
  limit: number = INVITE_GENERATION_LIMIT,
): Promise<QuotaResult> {
  const claimed = await prisma.travelInvite.updateMany({
    where: { grantId, generations: { lt: limit } },
    data: { generations: { increment: 1 } },
  });

  if (claimed.count !== 1) {
    // 没抢到：要么额度用尽，要么该身份不对应任何邀请码
    const current = await getInviteQuota(grantId, limit);

    return { allowed: false, used: current.used, limit };
  }

  const after = await getInviteQuota(grantId, limit);

  return { allowed: true, used: after.used, limit };
}

/** 邀请码记录（对外返回时不含 codeHash） */
export interface InviteRecord {
  id: number;
  grantId: string;
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
  usedIp: string | null;
}

/**
 * 归一化用户输入的码。
 *
 * 允许带横线、空格、大小写混用 —— 朋友可能手抄或口述转达。
 * 统一成「大写字母数字」再哈希，这样 `trv-7k2m-9x4p` 与
 * `TRV-7K2M-9X4P` 等价。
 */
export function normalizeCode(input: string): string {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** 把 8 位随机段格式化成 TRV-XXXX-XXXX */
function formatCode(random: string): string {
  return `${CODE_PREFIX}-${random.slice(0, 4)}-${random.slice(4)}`;
}

/** 生成一个随机段（无偏取模，避免字符分布不均） */
function randomSegment(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);

  // 31 不整除 256，直接取模会让前 8 个字符概率略高。
  // 这里用拒绝采样：丢掉 >= 248（31*8）的字节重抽。
  const limit = 256 - (256 % CODE_ALPHABET.length);

  let out = "";

  while (out.length < CODE_LENGTH) {
    const fresh = new Uint8Array(CODE_LENGTH * 2);
    crypto.getRandomValues(fresh);

    for (const b of fresh) {
      if (b >= limit) continue; // 丢弃，避免模偏差
      out += CODE_ALPHABET[b % CODE_ALPHABET.length];
      if (out.length === CODE_LENGTH) break;
    }
  }

  return out;
}

/**
 * 生成一个不可猜测的身份标识。
 *
 * 用随机十六进制而不是自增 id：这个值会明文写进 Cookie，
 * 自增 id 会暴露「一共有多少个好友」这类信息。
 *
 * 不能含点号 —— Cookie 格式用「最后一个小数点」分隔身份和签名。
 */
function randomGrantId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);

  return (
    "g" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/** 计算码的 SHA-256（十六进制） */
export async function hashCode(code: string): Promise<string> {
  const normalized = normalizeCode(code);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`travel-invite|${normalized}`),
  );

  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 判断输入是否「看起来像邀请码」。
 *
 * 归一化后是 TRV + 8 位共 11 个字符。
 * 登录表单只有一个输入框，靠这个区分「输的是码还是口令」——
 * 让用户自己选「我是主人还是访客」会很别扭。
 *
 * 只做格式判断，不做有效性判断 —— 有效性由查表决定。
 */
export function looksLikeInviteCode(input: string): boolean {
  const normalized = normalizeCode(input);

  return normalized.length === CODE_PREFIX.length + CODE_LENGTH && normalized.startsWith(CODE_PREFIX);
}

/**
 * 生成一个新邀请码。
 *
 * @param options.note 备注（给谁的），便于核对
 * @param options.days 有效期天数，默认 1
 * @returns 明文码（仅此一次可见）、过期时间、身份标识
 */
export async function createInvite(options: {
  note?: string | null;
  days?: number;
} = {}): Promise<{ code: string; grantId: string; expiresAt: Date }> {
  const days = Math.max(1, Math.floor(options.days ?? DEFAULT_INVITE_DAYS));
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const random = randomSegment();
  const code = formatCode(random);
  const codeHash = await hashCode(code);
  const grantId = randomGrantId();

  await prisma.travelInvite.create({
    data: {
      codeHash,
      grantId,
      note: options.note?.trim() || null,
      expiresAt,
    },
  });

  return { code, grantId, expiresAt };
}

/**
 * 兑换邀请码。
 *
 * 成功后返回该码对应的 grantId，失败返回 null（不区分原因，
 * 避免给出「码存在但已用过」这类可枚举信息）。
 *
 * @param code 用户输入的码
 * @param ip   兑换来源 IP（只记录，便于排查异常）
 */
export async function consumeInvite(
  code: string,
  ip?: string | null,
): Promise<string | null> {
  const codeHash = await hashCode(code);
  const now = new Date();

  // 原子抢占：条件更新，影响行数为 1 才算成功
  const claimed = await prisma.travelInvite.updateMany({
    where: {
      codeHash,
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      usedAt: now,
      usedIp: ip ? String(ip).slice(0, 64) : null,
    },
  });

  if (claimed.count !== 1) {
    return null;
  }

  const record = await prisma.travelInvite.findUnique({
    where: { codeHash },
    select: { grantId: true },
  });

  return record?.grantId ?? null;
}

/**
 * 按 id 撤销未使用的码。
 *
 * 页面用这个 —— 列表接口不返回明文（库里只有哈希），前端拿不到码。
 * 与 revokeInvite 的区别只是定位方式，撤销逻辑相同：
 * 把 expiresAt 提前到当前时间，保留记录痕迹。
 */
export async function revokeInviteById(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;

  const result = await prisma.travelInvite.updateMany({
    where: { id, usedAt: null },
    data: { expiresAt: new Date(0) },
  });

  return result.count === 1;
}

/** 列出所有邀请码（不含明文与哈希） */
export async function listInvites(): Promise<InviteRecord[]> {
  return prisma.travelInvite.findMany({
    select: {
      id: true,
      grantId: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      usedAt: true,
      usedIp: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * 撤销一个尚未使用的码。
 *
 * 实现方式是把 expiresAt 提前到当前时间 —— 不删记录，
 * 保留「曾经发过这个码」的痕迹。
 *
 * @returns 是否撤销成功（码不存在或已使用时为 false）
 */
export async function revokeInvite(code: string): Promise<boolean> {
  const codeHash = await hashCode(code);

  const result = await prisma.travelInvite.updateMany({
    where: { codeHash, usedAt: null },
    data: { expiresAt: new Date(0) },
  });

  return result.count === 1;
}
