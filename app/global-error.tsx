"use client";

/**
 * 根布局级别的错误兜底。
 * 当根 layout 自身抛错时启用，因此必须自己渲染 html / body。
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          background: "#000",
          color: "#fff",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", padding: "0 24px" }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>
            应用启动失败
          </h1>

          <p style={{ color: "#9ca3af", marginBottom: 24 }}>
            根布局渲染时发生严重错误，请刷新页面重试。
          </p>

          {error.digest ? (
            <p style={{ color: "#4b5563", fontSize: 12, marginBottom: 24 }}>
              错误编号：{error.digest}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => retry()}
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              border: "none",
              background: "#fff",
              color: "#000",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            重试
          </button>
        </div>
      </body>
    </html>
  );
}
