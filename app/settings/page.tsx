"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Me {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  monthly_quota: number;
  quota_used: number;
  quota_period: string;
  llm_base_url: string | null;
  llm_model: string | null;
  has_llm_key: boolean;
}

export default function SettingsPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [llmBaseUrl, setLlmBaseUrl] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [llmKey, setLlmKey] = useState(""); // 空串 = 不变；"__CLEAR__" = 主动清除
  const [clearKey, setClearKey] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");

  const load = async () => {
    const res = await fetch("/api/me");
    if (res.ok) {
      const data: Me = await res.json();
      setMe(data);
      setName(data.name ?? "");
      setLlmBaseUrl(data.llm_base_url ?? "");
      setLlmModel(data.llm_model ?? "");
    }
  };
  useEffect(() => {
    load();
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const body: Record<string, unknown> = {
      name,
      llm_base_url: llmBaseUrl,
      llm_model: llmModel,
    };
    if (clearKey) {
      body.llm_api_key = "";
    } else if (llmKey.trim()) {
      body.llm_api_key = llmKey.trim();
    }

    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setMsg({ type: "ok", text: "已保存" });
      setLlmKey("");
      setClearKey(false);
      load();
    } else {
      setMsg({ type: "err", text: data?.error || "保存失败" });
    }
  };

  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (newPw.length < 6) {
      setMsg({ type: "err", text: "新密码至少 6 位" });
      return;
    }
    setLoading(true);
    const res = await fetch("/api/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok) {
      setMsg({ type: "ok", text: "密码已更新" });
      setCurrentPw("");
      setNewPw("");
    } else {
      setMsg({ type: "err", text: data?.error || "密码修改失败" });
    }
  };

  if (!me) {
    return <div className="p-10 text-[#71717A]">加载中…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 text-[#E4E4E7]">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-xs text-[#71717A] hover:text-[#C8A96E]">
        <ChevronLeft className="h-3.5 w-3.5" />
        返回主页
      </Link>

      <h1 className="mb-1 font-serif text-2xl font-bold text-[#C8A96E]">个人设置</h1>
      <p className="mb-6 text-xs text-[#71717A]">{me.email} · {me.role === "admin" ? "管理员" : "普通用户"}</p>

      {msg && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-xs ${
            msg.type === "ok" ? "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]" : "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]"
          }`}
        >
          {msg.text}
        </div>
      )}

      <section className="mb-8 rounded-lg border border-[#2A2A2E] bg-[#141416] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#E4E4E7]">本月配额</h2>
        <div className="text-xs text-[#A1A1AA]">
          已用 <span className="text-[#C8A96E] font-medium">{me.quota_used}</span> /{" "}
          <span className="text-[#E4E4E7]">{me.monthly_quota}</span> 次（周期 {me.quota_period}，下月 1 号重置）
        </div>
      </section>

      <form onSubmit={saveProfile} className="mb-8 rounded-lg border border-[#2A2A2E] bg-[#141416] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#E4E4E7]">资料 & LLM Key</h2>

        <label className="mb-1 block text-xs text-[#A1A1AA]">昵称</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <div className="mb-3 rounded border border-[#2A2A2E]/60 bg-[#0A0A0B]/40 p-3 text-[11px] text-[#71717A]">
          填写下面三项可使用你自己的 LLM（任意 OpenAI 兼容接口）。
          三项需全部填写才生效；留空则使用系统配置的默认 Key（但仍计入你本月配额）。
        </div>

        <label className="mb-1 block text-xs text-[#A1A1AA]">Base URL（例如 https://api.deepseek.com）</label>
        <input
          value={llmBaseUrl}
          onChange={(e) => setLlmBaseUrl(e.target.value)}
          placeholder="留空使用系统默认"
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <label className="mb-1 block text-xs text-[#A1A1AA]">Model</label>
        <input
          value={llmModel}
          onChange={(e) => setLlmModel(e.target.value)}
          placeholder="例如 deepseek-chat / gpt-4o-mini"
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <label className="mb-1 block text-xs text-[#A1A1AA]">
          API Key{" "}
          <span className="text-[#52525B]">
            （当前状态：{me.has_llm_key ? "已设置" : "未设置"}；留空保持不变）
          </span>
        </label>
        <input
          type="password"
          value={llmKey}
          onChange={(e) => setLlmKey(e.target.value)}
          placeholder={me.has_llm_key ? "已保存，留空保持不变" : "sk-..."}
          className="mb-3 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm focus:border-[#C8A96E]/60 focus:outline-none"
        />

        {me.has_llm_key && (
          <label className="mb-4 flex items-center gap-2 text-xs text-[#71717A]">
            <input type="checkbox" checked={clearKey} onChange={(e) => setClearKey(e.target.checked)} />
            清除已保存的 API Key（改为使用系统默认）
          </label>
        )}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-[#C8A96E] px-4 py-2 text-sm font-medium text-[#0A0A0B] hover:bg-[#8A7344] disabled:opacity-50"
        >
          {loading ? "保存中…" : "保存"}
        </button>
      </form>

      <form onSubmit={changePw} className="rounded-lg border border-[#2A2A2E] bg-[#141416] p-5">
        <h2 className="mb-3 text-sm font-semibold text-[#E4E4E7]">修改密码</h2>

        <label className="mb-1 block text-xs text-[#A1A1AA]">当前密码</label>
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <label className="mb-1 block text-xs text-[#A1A1AA]">新密码（至少 6 位）</label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          className="mb-4 w-full rounded border border-[#2A2A2E] bg-[#0A0A0B] px-3 py-2 text-sm focus:border-[#C8A96E]/60 focus:outline-none"
        />

        <button
          type="submit"
          disabled={loading || !currentPw || !newPw}
          className="rounded bg-[#C8A96E] px-4 py-2 text-sm font-medium text-[#0A0A0B] hover:bg-[#8A7344] disabled:opacity-50"
        >
          {loading ? "更新中…" : "更新密码"}
        </button>
      </form>
    </div>
  );
}
