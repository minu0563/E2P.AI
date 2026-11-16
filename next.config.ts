import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents(PPR)는 OpenNext/Workers에서 요청 간 프라미스 공유 문제를 일으켜 끈다
  // (한 요청의 캐시가 다른 요청에 섞일 위험). 페이지는 요청마다 렌더링하고, 공개 페이지 정적화는 이후 별도로.
  poweredByHeader: false,
  async headers() {
    const prod = process.env.NODE_ENV === "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // 스크립트 제한(nonce 기반 CSP)은 광고·결제 스크립트를 넣을 때 함께 정한다
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          ...(prod ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
