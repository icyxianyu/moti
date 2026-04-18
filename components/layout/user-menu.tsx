"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserCircle2, Settings, ShieldCheck, LogOut } from "lucide-react";

interface MeSummary {
  id: string;
  email: string;
  name: string | null;
  role: "user" | "admin";
  monthly_quota: number;
  quota_used: number;
  quota_period: string;
  has_llm_key: boolean;
}

export function UserMenu() {
  const { data: session } = useSession();
  const [me, setMe] = useState<MeSummary | null>(null);

  useEffect(() => {
    if (!session?.user) {
      setMe(null);
      return;
    }
    let active = true;
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active) setMe(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session?.user]);

  if (!session?.user) return null;

  const quotaLeft = me ? Math.max(me.monthly_quota - me.quota_used, 0) : null;
  const isAdmin = session.user.role === "admin";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 rounded-full border border-[#2A2A2E] bg-[#141416] px-2.5 py-1 text-xs text-[#A1A1AA] hover:border-[#C8A96E]/40 hover:text-[#E4E4E7]">
          <UserCircle2 className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">{session.user.name || session.user.email}</span>
          {isAdmin && (
            <span className="rounded bg-[#C8A96E]/15 px-1 text-[10px] text-[#C8A96E]">admin</span>
          )}
          {quotaLeft !== null && !isAdmin && (
            <span className="text-[10px] text-[#71717A]">· 余 {quotaLeft}</span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 border-[#2A2A2E] bg-[#141416] text-[#E4E4E7]">
        <DropdownMenuLabel className="text-[#71717A]">
          <div className="truncate">{session.user.email}</div>
          {me && (
            <div className="mt-0.5 text-[10px] text-[#52525B]">
              本月 {me.quota_used}/{me.monthly_quota} 次 ·{" "}
              {me.has_llm_key ? "自带 LLM Key" : "走系统 Key"}
            </div>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-[#2A2A2E]" />
        <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#1C1C20] focus:text-[#C8A96E]">
          <Link href="/settings">
            <Settings className="mr-2 h-3.5 w-3.5" />
            个人设置
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#1C1C20] focus:text-[#C8A96E]">
            <Link href="/admin">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              后台管理
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator className="bg-[#2A2A2E]" />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="cursor-pointer focus:bg-[#1C1C20] focus:text-[#EF4444]"
        >
          <LogOut className="mr-2 h-3.5 w-3.5" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
