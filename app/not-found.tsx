export default function NotFound() {
  return (
    <div
      className="
min-h-screen
bg-black
text-white
flex
items-center
justify-center
"
    >
      <div
        className="
text-center
"
      >
        <h1
          className="
text-6xl
font-bold
"
        >
          404
        </h1>

        <p
          className="
mt-5
text-gray-400
"
        >
          页面不存在
        </p>

        <a
          href="/"

          className="
mt-8
inline-block
border
border-gray-700
px-6
py-3
rounded-xl
"
        >
          返回首页
        </a>
      </div>
    </div>
  );
}
