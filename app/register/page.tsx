"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: name || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      toast.error(data?.error || "注册失败");
      return;
    }

    toast.success(data?.message || "注册成功，正在登录…");

    // 注册成功后自动登录
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (login?.ok) {
      router.replace("/");
      router.refresh();
    } else {
      toast.message("请手动登录");
      router.replace("/login");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-[#2A2A2E] bg-[#141416] p-6 shadow-xl"
      >
        <h1 className="mb-1 font-serif text-xl font-bold tracking-wide text-[#C8A96E]">
          Moti<span className="ml-1.5 text-[#52525B] text-xs font-normal tracking-widest">墨替</span>
        </h1>
        <p className="mb-6 text-xs text-[#71717A]">注册新账号</p>

        <label className="mb-1 block text-xs text-[#A1A1AA]">邮箱</label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder:text-[#52525B] focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <label className="mb-1 block text-xs text-[#A1A1AA]">昵称（可选）</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder:text-[#52525B] focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <label className="mb-1 block text-xs text-[#A1A1AA]">密码（至少 6 位）</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E4E4E7] placeholder:text-[#52525B] focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-[#C8A96E] py-2 text-sm font-medium text-[#0A0A0B] hover:bg-[#8A7344] disabled:opacity-50"
        >
          {loading ? "处理中…" : "注册并登录"}
        </button>

        <p className="mt-4 text-center text-xs text-[#71717A]">
          已有账号？{" "}
          <Link href="/login" className="text-[#C8A96E] hover:underline">
            去登录
          </Link>
        </p>
      </form>
    </div>
  );
}
