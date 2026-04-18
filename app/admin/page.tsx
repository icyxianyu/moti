"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  status: "active" | "banned";
  monthly_quota: number;
  quota_used: number;
  quota_period: string;
  has_llm_key: boolean;
  created_at: string;
}

interface AdminAuthor {
  id: string;
  name: string;
  owner_id: string | null;
  visibility: "private" | "public";
  created_at: string;
}

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "authors">("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [authors, setAuthors] = useState<AdminAuthor[]>([]);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadUsers = async () => {
    const res = await fetch("/api/admin/users");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (res.ok) setUsers(await res.json());
  };
  const loadAuthors = async () => {
    const res = await fetch("/api/admin/authors");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (res.ok) setAuthors(await res.json());
  };
  useEffect(() => {
    loadUsers();
    loadAuthors();
  }, []);

  const patchUser = async (uid: string, patch: Record<string, unknown>) => {
    setMsg(null);
    const res = await fetch(`/api/admin/users/${uid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: "ok", text: "已更新" });
      loadUsers();
    } else {
      setMsg({ type: "err", text: data?.error || "更新失败" });
    }
  };

  const deleteUser = async (uid: string) => {
    if (!confirm("确定删除该用户？其私人作家/语料/生成历史会一并删除，不可恢复。")) return;
    const res = await fetch(`/api/admin/users/${uid}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: "ok", text: "已删除" });
      loadUsers();
      loadAuthors();
    } else {
      setMsg({ type: "err", text: data?.error || "删除失败" });
    }
  };

  const changeVisibility = async (id: string, visibility: "public" | "private") => {
    const res = await fetch(`/api/admin/authors/${id}/visibility`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setMsg({ type: "ok", text: "可见性已更新" });
      loadAuthors();
    } else {
      setMsg({ type: "err", text: data?.error || "更新失败" });
    }
  };

  if (forbidden) {
    return (
      <div className="p-10 text-[#EF4444]">
        需要管理员权限。{" "}
        <Link href="/" className="text-[#C8A96E] underline">
          返回主页
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-[#E4E4E7]">
      <Link href="/" className="mb-6 inline-flex items-center gap-1 text-xs text-[#71717A] hover:text-[#C8A96E]">
        <ChevronLeft className="h-3.5 w-3.5" />
        返回主页
      </Link>

      <h1 className="mb-1 font-serif text-2xl font-bold text-[#C8A96E]">后台管理</h1>
      <p className="mb-6 text-xs text-[#71717A]">用户与公共作家的管理入口</p>

      <div className="mb-4 flex gap-1 border-b border-[#2A2A2E]">
        {[
          { id: "users", label: `用户（${users.length}）` },
          { id: "authors", label: `作家（${authors.length}）` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as "users" | "authors")}
            className={`-mb-px border-b-2 px-4 py-2 text-sm ${
              tab === t.id ? "border-[#C8A96E] text-[#C8A96E]" : "border-transparent text-[#71717A] hover:text-[#E4E4E7]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {msg && (
        <div
          className={`mb-4 rounded border px-3 py-2 text-xs ${
            msg.type === "ok" ? "border-[#4ADE80]/30 bg-[#4ADE80]/10 text-[#4ADE80]" : "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]"
          }`}
        >
          {msg.text}
        </div>
      )}

      {tab === "users" && (
        <div className="rounded-lg border border-[#2A2A2E] bg-[#141416] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1C1C20] text-[#71717A]">
              <tr>
                <th className="px-3 py-2">邮箱</th>
                <th className="px-3 py-2">角色</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">本月</th>
                <th className="px-3 py-2">月配额</th>
                <th className="px-3 py-2">Key</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-[#2A2A2E] text-[#E4E4E7]">
                  <td className="px-3 py-2">
                    <div>{u.email}</div>
                    {u.name && <div className="text-[10px] text-[#52525B]">{u.name}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.role}
                      onChange={(e) => patchUser(u.id, { role: e.target.value })}
                      className="rounded border border-[#2A2A2E] bg-[#0A0A0B] px-2 py-1 text-xs"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={u.status}
                      onChange={(e) => patchUser(u.id, { status: e.target.value })}
                      className="rounded border border-[#2A2A2E] bg-[#0A0A0B] px-2 py-1 text-xs"
                    >
                      <option value="active">active</option>
                      <option value="banned">banned</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 text-[#A1A1AA]">
                    {u.quota_used}
                    <span className="text-[#52525B]"> / {u.quota_period}</span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      defaultValue={u.monthly_quota}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== u.monthly_quota) patchUser(u.id, { monthly_quota: v });
                      }}
                      className="w-20 rounded border border-[#2A2A2E] bg-[#0A0A0B] px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-3 py-2 text-[#71717A]">{u.has_llm_key ? "自带" : "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => patchUser(u.id, { reset_quota_used: true })}
                      className="mr-2 text-[#C8A96E] hover:underline"
                    >
                      重置配额
                    </button>
                    <button
                      onClick={() => deleteUser(u.id)}
                      className="text-[#EF4444] hover:underline"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "authors" && (
        <div className="rounded-lg border border-[#2A2A2E] bg-[#141416] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#1C1C20] text-[#71717A]">
              <tr>
                <th className="px-3 py-2">作家</th>
                <th className="px-3 py-2">所有者</th>
                <th className="px-3 py-2">可见性</th>
                <th className="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {authors.map((a) => {
                const owner = users.find((u) => u.id === a.owner_id);
                return (
                  <tr key={a.id} className="border-t border-[#2A2A2E] text-[#E4E4E7]">
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-[#A1A1AA]">
                      {owner ? owner.email : a.owner_id ? <span className="text-[#52525B]">未知({a.owner_id.slice(0, 6)})</span> : <span className="text-[#52525B]">（无主）</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          a.visibility === "public"
                            ? "bg-[#4ADE80]/10 text-[#4ADE80]"
                            : "bg-[#52525B]/20 text-[#71717A]"
                        }`}
                      >
                        {a.visibility}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {a.visibility === "private" ? (
                        <button
                          onClick={() => changeVisibility(a.id, "public")}
                          className="text-[#C8A96E] hover:underline"
                        >
                          发布为公共
                        </button>
                      ) : (
                        <button
                          onClick={() => changeVisibility(a.id, "private")}
                          className="text-[#71717A] hover:underline"
                        >
                          取消公开
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
