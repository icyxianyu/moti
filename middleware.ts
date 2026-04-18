import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * 全站路由守卫。next-auth@5 要求 middleware 使用 Edge-safe 的 authConfig。
 *
 * matcher 排除：
 *   - /api/auth/*  （next-auth 自己的端点，必须放行）
 *   - 静态资源 / _next 内部文件 / 图标等
 * 其余一切（包括页面和其他 /api/**）都走 authorized() 守卫。
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    /*
     * 排除下列路径：
     * - api/auth (NextAuth 登录接口本身)
     * - _next/static / _next/image
     * - 常见静态资源文件（后缀）
     * - manifest / favicon / icon / apple-touch-icon / og-image
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png|og-image.png|robots.txt|sitemap.xml).*)",
  ],
};
