"use server";

import { createServerClient } from "@/lib/supabase";
import { hashPassword } from "@/lib/hash";
import { redirect } from "next/navigation";

export async function signup(
  prevState: { error: string } | null,
  formData: FormData
) {
  const login_id = (formData.get("login_id") as string)?.trim();
  const password  = formData.get("password") as string;
  const confirm   = formData.get("confirm") as string;
  const name      = (formData.get("name") as string)?.trim();
  const dept      = formData.get("dept") as string;
  const role      = formData.get("role") as string;

  if (!login_id || !password || !name || !dept)
    return { error: "모든 필드를 입력해주세요." };

  if (password !== confirm)
    return { error: "비밀번호가 일치하지 않습니다." };

  if (password.length < 4)
    return { error: "비밀번호는 4자 이상이어야 합니다." };

  const db = createServerClient();

  // 중복 아이디 확인
  const { data: existing } = await db
    .from("members")
    .select("id")
    .eq("login_id", login_id)
    .maybeSingle();

  if (existing) return { error: "이미 사용 중인 아이디입니다." };

  // 등록
  const { error } = await db.from("members").insert({
    login_id,
    password: hashPassword(password),
    name,
    dept,
    role: role === "manager" ? "manager" : "worker",
    active: true,
  });

  if (error) return { error: "등록 실패: " + error.message };

  redirect("/login?registered=1");
}
