import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// 빌드 시점 최적화 방지 — 환경변수를 항상 런타임에 읽도록 강제
export const dynamic = "force-dynamic";

/** 전체 HTML 문서에서 <body> 내용만 추출. body가 없으면 원본 반환 */
function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

/** <style>, <script>, <link> 태그(내용 포함)·HTML 주석 제거 */
function stripHeadTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
}

/**
 * 회의록 업로드 API — 브리핑 업로드(/api/briefings/upload)와 동일한 인증 체계
 *
 * POST body(JSON):
 *   meeting_date  "YYYY-MM-DD" (필수)
 *   title         제목 (필수)
 *   content_html  HTML 본문 (필수 — <body>만 자동 추출, style/script 제거)
 *   summary       한 줄 요약 (선택, 목록 카드에 표시)
 *   author        작성자 (선택, 기본 "COO 조상일")
 *   source        출처 (선택, 기본 "daglo")
 */
export async function POST(req: NextRequest) {
  // ── API Key 인증 (브리핑 업로드와 같은 키 사용) ─────────────
  const VALID_KEY   = process.env["BRIEFING_API_KEY"] ?? "saelim2026";
  const authHeader  = req.headers.get("Authorization") ?? "";
  const providedKey = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (!providedKey || providedKey !== VALID_KEY) {
    return NextResponse.json({ error: "인증 실패: API Key를 확인해주세요" }, { status: 401 });
  }

  // ── Body 파싱 ────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식 오류: JSON을 파싱할 수 없습니다" }, { status: 400 });
  }

  const { meeting_date, title, content_html, summary, author, source } = body;

  if (!meeting_date || !title || !content_html) {
    return NextResponse.json(
      { error: "필수 항목 누락: meeting_date, title, content_html 은 필수입니다" },
      { status: 400 }
    );
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(meeting_date))) {
    return NextResponse.json(
      { error: "meeting_date 형식 오류: YYYY-MM-DD 형식이어야 합니다" },
      { status: 400 }
    );
  }

  const cleanedHtml = stripHeadTags(extractBody(String(content_html)));

  // ── Supabase insert ──────────────────────────────────────────
  const db = createServerClient();
  const { data, error } = await db
    .from("meeting_minutes")
    .insert({
      meeting_date: String(meeting_date),
      title:        String(title),
      content_html: cleanedHtml,
      summary:      summary ? String(summary) : null,
      author:       String(author ?? "COO 조상일"),
      source:       String(source ?? "daglo"),
    })
    .select("id")
    .single();

  if (error) {
    // 42P01: 테이블 미존재 — 마이그레이션(029) 미실행 안내
    if (error.code === "42P01") {
      return NextResponse.json(
        { error: "meeting_minutes 테이블이 없습니다. supabase/029_meeting_minutes.sql을 먼저 실행해주세요." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: "ok" }, { status: 201 });
}
