"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase";

export type BriefingRead = {
  user_id: string;
  user_name: string;
};

export type BriefingComment = {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
};

// ── 읽었어요 토글 ────────────────────────────────────────────
export async function toggleBriefingRead(briefingId: string) {
  const session = await getSession();
  if (!session) return { error: "로그인 필요" };

  const db = createServerClient();

  // 이미 읽었는지 확인
  const { data: existing } = await db
    .from("briefing_reads")
    .select("id")
    .eq("briefing_id", briefingId)
    .eq("user_id", session.id)
    .single();

  if (existing) {
    // 이미 읽음 → 취소
    await db.from("briefing_reads").delete().eq("id", existing.id);
  } else {
    // 아직 안 읽음 → 등록
    await db.from("briefing_reads").insert({
      briefing_id: briefingId,
      user_id: session.id,
      user_name: session.name,
    });
  }

  // 최신 reads 목록 반환
  const { data: reads } = await db
    .from("briefing_reads")
    .select("user_id, user_name")
    .eq("briefing_id", briefingId)
    .order("created_at", { ascending: true });

  revalidatePath(`/briefings/${briefingId}`);
  return { reads: (reads ?? []) as BriefingRead[] };
}

// ── 댓글 추가 ────────────────────────────────────────────────
export async function addBriefingComment(briefingId: string, content: string) {
  const session = await getSession();
  if (!session) return { error: "로그인 필요" };

  const trimmed = content.trim();
  if (!trimmed) return { error: "댓글 내용을 입력해주세요" };
  if (trimmed.length > 500) return { error: "500자 이내로 입력해주세요" };

  const db = createServerClient();
  const { data, error } = await db
    .from("briefing_comments")
    .insert({
      briefing_id: briefingId,
      user_id: session.id,
      user_name: session.name,
      content: trimmed,
    })
    .select("id, user_id, user_name, content, created_at")
    .single();

  if (error) return { error: error.message };

  revalidatePath(`/briefings/${briefingId}`);
  return { comment: data as BriefingComment };
}

// ── 댓글 삭제 ────────────────────────────────────────────────
export async function deleteBriefingComment(commentId: string, briefingId: string) {
  const session = await getSession();
  if (!session) return { error: "로그인 필요" };

  const db = createServerClient();

  // 본인 또는 COO만 삭제 가능
  const { data: comment } = await db
    .from("briefing_comments")
    .select("user_id")
    .eq("id", commentId)
    .single();

  if (!comment) return { error: "댓글을 찾을 수 없습니다" };
  if (comment.user_id !== session.id && session.role !== "coo") {
    return { error: "삭제 권한이 없습니다" };
  }

  await db.from("briefing_comments").delete().eq("id", commentId);
  revalidatePath(`/briefings/${briefingId}`);
  return { success: true };
}
