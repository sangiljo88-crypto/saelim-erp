"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encrypt, MOCK_USERS, roleHomePath, Role } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { verifyPassword } from "@/lib/hash";

export async function login(prevState: { error: string } | null, formData: FormData) {
  const id       = (formData.get("id") as string)?.trim();
  const password = formData.get("password") as string;

  // ── 1. DB에서 먼저 조회 (members 테이블) ─────────────────
  try {
    const db = createServerClient();
    const { data: member } = await db
      .from("members")
      .select("id, login_id, password, name, role, dept, active")
      .eq("login_id", id)
      .eq("active", true)
      .maybeSingle();

    if (member) {
      if (!verifyPassword(password, member.password)) {
        return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
      }
      const token = await encrypt({
        id: member.login_id,
        name: member.name,
        role: member.role as Role,
        dept: member.dept ?? "",
      });
      const cookieStore = await cookies();
      cookieStore.set("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 8,
        path: "/",
      });
      redirect(roleHomePath(member.role as Role));
    }
  } catch {
    // DB 오류 시 목업으로 fallback
  }

  // ── 2. 목업 사용자 fallback ───────────────────────────────
  const user = MOCK_USERS.find((u) => u.id === id && u.password === password);
  if (!user) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const token = await encrypt({
    id: user.id,
    name: user.name,
    role: user.role,
    dept: user.dept,
  });

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8,
    path: "/",
  });

  redirect(roleHomePath(user.role));
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
  redirect("/login");
}
