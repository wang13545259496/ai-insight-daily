import Link from "next/link";

export default async function ResearchDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const { id } = await params;

  return (
    <div
      className="
min-h-screen
bg-black
text-white
p-10
"
    >
      <div
        className="
max-w-5xl
mx-auto
"
      >
        <h1
          className="
text-4xl
font-bold
"
        >
          研究分析报告
        </h1>

        <p
          className="
mt-6
text-gray-400
"
        >
          报告编号：
          {id}
        </p>

        <section
          className="
mt-10
border
border-gray-800
rounded-3xl
bg-gray-950
p-8
"
        >
          <h2
            className="
text-2xl
font-bold
"
          >
            AI产业研究分析
          </h2>

          <p
            className="
mt-5
text-gray-300
leading-8
"
          >
            该研究模块用于展示 AI 产业趋势、技术方向、
            商业机会以及未来发展分析。
          </p>

          <p
            className="
mt-5
text-gray-400
leading-8
"
          >
            当前版本已完成全站发布兼容， 后续可接入研究数据库。
          </p>
        </section>

        <Link
          href="/research"

          className="
mt-10
inline-block
text-gray-400
hover:text-white
"
        >
          ← 返回研究中心
        </Link>
      </div>
    </div>
  );
}
