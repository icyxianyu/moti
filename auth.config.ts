import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe 的 NextAuth 基础配置：
 * - 仅包含 middleware 所需的 callbacks / pages，不引入 Node-only 依赖（bcryptjs/better-sqlite3）
 * - 真正的 Credentials provider 在 auth.ts 里扩展
 *
 * 这样拆分是因为 Next.js middleware 跑在 Edge Runtime，
 * 若直接 import auth.ts 会把 sqlite / bcrypt 带进 Edge bundle，构建必然失败。
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    /**
     * middleware 调用的守卫。所有非白名单路由都要求 session.user 存在。
     * 白名单由 middleware.ts 的 matcher 决定；这里再做一次兜底。
     */
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // 公开页面
      const publicPaths = ["/login", "/register"];
      const isPublicPage = publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

      if (isPublicPage) {
        // 已登录访问登录/注册页：跳回首页
        if (isLoggedIn) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      // 其他所有路径（包括 API）都必须登录
      return isLoggedIn;
    },
    async jwt({ token, user }) {
      // 登录时：把 id / role 塞进 token
      if (user) {
        token.id = (user as { id?: string }).id ?? token.sub;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "user" | "admin";
      }
      return session;
    },
  },
  providers: [], // 真正的 provider 在 auth.ts 里注入
} satisfies NextAuthConfig;
