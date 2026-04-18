"use client";

import { Suspense, useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const callbackUrl = sp.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      toast.success("登录成功");
      router.replace(callbackUrl);
      router.refresh();
    } else {
      toast.error("邮箱或密码不正确");
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm rounded-lg border border-[#2A2A2E] bg-[#141416] p-6 shadow-xl"
    >
      <h1 className="mb-1 font-serif text-xl font-bold tracking-wide text-[#C8A96E]">
        Moti<span className="ml-1.5 text-[#52525B] text-xs font-normal tracking-widest">墨替</span>
      </h1>
      <p className="mb-6 text-xs text-[#71717A]">登录继续写作</p>

      <label className="mb-1 block text-xs text-[#A1A1AA]">邮箱</label>
      <input
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder:text-[#52525B] focus:border-[#C8A96E]/60 focus:outline-none"
      />

      <label className="mb-1 block text-xs text-[#A1A1AA]">密码</label>
      <input
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder:text-[#52525B] focus:border-[#C8A96E]/60 focus:outline-none"
      />

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded bg-[#C8A96E] py-2 text-sm font-medium text-[#0A0A0B] hover:bg-[#8A7344] disabled:opacity-50"
      >
        {loading ? "登录中…" : "登录"}
      </button>

      <p className="mt-4 text-center text-xs text-[#71717A]">
        还没有账号？{" "}
        <Link href="/register" className="text-[#C8A96E] hover:underline">
          去注册
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] px-4">
      <Suspense fallback={<div className="text-sm text-[#71717A]">加载中…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
