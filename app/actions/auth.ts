"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encrypt, MOCK_USERS, roleHomePath, Role } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";
import { verifyPassword } from "@/lib/hash";

// 알려진 목업 계정 ID 접두어 (DB 조회 건너뛰기)
const MOCK_ID_PREFIXES = ["ceo", "coo", "mgr_", "worker"];

function isMockId(id: string): boolean {
  return MOCK_ID_PREFIXES.some((prefix) => id === prefix || id.startsWith(prefix));
}

// 3초 타임아웃 래퍼
function withTimeout<T>(promise: PromiseLike<T>, ms = 3000): Promise<T | null> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export async function login(prevState: { error: string } | null, formData: FormData) {
  const id       = (formData.get("id") as string)?.trim();
  const password = formData.get("password") as string;

  // ── 0. 목업 계정 ID는 DB 조회 건너뛰고 바로 매칭 (즉시 로그인) ──
  if (isMockId(id)) {
    const user = MOCK_USERS.find((u) => u.id === id && u.password === password);
    if (user) {
      const token = await encrypt({
        id: user.id, name: user.name, role: user.role, dept: user.dept,
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
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  // ── 1. DB에서 조회 (타임아웃 3초) ─────────────────────────
  try {
    const db = createServerClient();
    const queryPromise = db
      .from("members")
      .select("id, login_id, password, name, role, dept, active")
      .eq("login_id", id)
      .eq("active", true)
      .maybeSingle();

    const result = await withTimeout(queryPromise);

    if (result && result.data) {
      const member = result.data;
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
    // DB 오류 시 fallback
  }

  // ── 2. 목업 사용자 fallback ───────────────────────────────
  const user = MOCK_USERS.find((u) => u.id === id && u.password === password);
  if (!user) {
    return { error: "아이디 또는 비밀번호가 올바르지 않습니다." };
  }

  const token = await encrypt({
    id: user.id, name: user.name, role: user.role, dept: user.dept,
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
