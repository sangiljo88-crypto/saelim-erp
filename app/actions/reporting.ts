"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 팀장 주간 보고 제출 ─────────────────────────────────────
export async function submitDeptReport(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
) {
  const session = await getSession();
  if (!session || session.role !== "manager") return { error: "팀장 권한 필요" };

  const db = createServerClient();
  const dept = session.dept ?? "";

  const payload = {
    report_date:  formData.get("report_date") as string,
    dept,
    manager_id:   session.id,
    manager_name: session.name,
    rag_status:   formData.get("rag_status") as string,
    issue:        formData.get("issue") as string,
    detail:       (formData.get("detail") as string) || null,
    next_action:  (formData.get("next_action") as string) || null,
    status:       "submitted",
  };

  const { error } = await db
    .from("dept_reports")
    .upsert(payload, { onConflict: "report_date,dept" });

  if (error) return { error: error.message };
  revalidatePath("/team");
  return { success: true };
}

// ── hljs 코드블록 span 태그 제거 ────────────────────────────────
// Claude/Genspark 등 AI 코드하이라이터가 감싼 <span class="hljs-*"> 제거
function stripHljsSpans(html: string): string {
  // hljs span을 내용만 남기고 제거 (중첩 처리 위해 반복)
  // 일반 </span>은 건드리지 않음
  let result = html;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result
      .replace(/<span\s+class="hljs-[^"]*"[^>]*>([\s\S]*?)<\/span>/g, "$1")
      .replace(/<span\s+class="language-[^"]*"[^>]*>([\s\S]*?)<\/span>/g, "$1");
  }
  // <code> 블록 안에 남은 불필요한 줄바꿈 정리
  return result.replace(/<code[^>]*>\s*\n/g, (m) => m.trimEnd());
}

// ── 브리핑 등록 (COO 전용) ────────────────────────────────────
export async function submitBriefing(data: {
  week_label: string;
  publish_date: string;
  category: string;
  title: string;
  content_html: string;
  author: string;
  is_pinned: boolean;
}) {
  const session = await getSession();
  if (!session || session.role !== "coo") throw new Error("COO 권한 필요");
  const db = createServerClient();
  const cleaned = { ...data, content_html: stripHljsSpans(data.content_html) };
  const { data: inserted, error } = await db.from("briefings").insert(cleaned).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/briefings");
  revalidatePath("/coo");
  return { success: true, id: inserted?.id };
}

// ── 브리핑 수정 (COO 전용) ────────────────────────────────────
export async function updateBriefing(id: string, data: {
  week_label: string;
  publish_date: string;
  category: string;
  title: string;
  content_html: string;
  author: string;
  is_pinned: boolean;
}) {
  const session = await getSession();
  if (!session || session.role !== "coo") throw new Error("COO 권한 필요");
  const db = createServerClient();
  const cleaned = { ...data, content_html: stripHljsSpans(data.content_html) };
  const { error } = await db.from("briefings").update(cleaned).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/briefings");
  revalidatePath(`/briefings/${id}`);
  return { success: true };
}

// ── 브리핑 삭제 (COO 전용) ────────────────────────────────────
export async function deleteBriefing(id: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  const db = createServerClient();
  const { error } = await db.from("briefings").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/briefings");
  return { success: true };
}

// ── 브리핑 핀 토글 (COO 전용) ────────────────────────────────
export async function toggleBriefingPin(id: string, is_pinned: boolean) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };
  const db = createServerClient();
  const { error } = await db.from("briefings").update({ is_pinned }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/briefings");
  return { success: true };
}

// ── COO 코멘트 저장 ──────────────────────────────────────────
export async function saveCooComment(reportId: string, comment: string) {
  const session = await getSession();
  if (!session || session.role !== "coo") return { error: "COO 권한 필요" };

  const db = createServerClient();
  const { error } = await db
    .from("dept_reports")
    .update({
      coo_comment:    comment,
      coo_id:         session.id,
      coo_updated_at: new Date().toISOString(),
      status:         "reviewed",
    })
    .eq("id", reportId);

  if (error) return { error: error.message };
  revalidatePath("/coo");
  revalidatePath("/dashboard");
  return { success: true };
}
