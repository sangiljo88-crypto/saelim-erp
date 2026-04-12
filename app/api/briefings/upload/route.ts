import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// 빌드 시점 최적화 방지 — 환경변수를 항상 런타임에 읽도록 강제
export const dynamic = "force-dynamic";

function stripHljsSpans(html: string): string {
  // hljs span 태그를 내용만 남기고 제거 (중첩 처리 위해 반복)
  // 일반 </span>은 절대 건드리지 않음
  let result = html;
  let prev = "";
  while (prev !== result) {
    prev = result;
    result = result
      .replace(/<span\s+class="hljs-[^"]*"[^>]*>([\s\S]*?)<\/span>/g, "$1")
      .replace(/<span\s+class="language-[^"]*"[^>]*>([\s\S]*?)<\/span>/g, "$1");
  }
  return result;
}

/** 전체 HTML 문서에서 <body> 내용만 추출. body가 없으면 원본 반환 */
function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch ? bodyMatch[1].trim() : html;
}

/** <style>, <script>, <link> 태그(내용 포함) 제거 */
function stripHeadTags(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<link[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")   // HTML 주석 제거
    .trim();
}

export async function POST(req: NextRequest) {
  // ── API Key 인증 ─────────────────────────────────────────────
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

  const { week_label, publish_date, target_dept, title, content_html, author, is_pinned } = body;

  if (!week_label || !publish_date || !title || !content_html) {
    return NextResponse.json(
      { error: "필수 항목 누락: week_label, publish_date, title, content_html 은 필수입니다" },
      { status: 400 }
    );
  }

  // ── <body> 추출 → style/script 제거 → hljs 태그 제거 ────────
  const bodyOnly    = extractBody(String(content_html));
  const noHeadTags  = stripHeadTags(bodyOnly);
  const cleanedHtml = stripHljsSpans(noHeadTags);

  // ── Supabase insert ──────────────────────────────────────────
  const db = createServerClient();
  const { data, error } = await db
    .from("briefings")
    .insert({
      week_label:   String(week_label),
      publish_date: String(publish_date),
      category:     String(target_dept ?? "업계동향"),
      title:        String(title),
      content_html: cleanedHtml,
      author:       String(author ?? "COO 조상일"),
      is_pinned:    Boolean(is_pinned ?? false),
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: "ok" }, { status: 201 });
}

// GET 요청 — 헬스체크 + 디버그
export async function GET(req: NextRequest) {
  const nodeEnv = (globalThis as Record<string, unknown>)["process"] as NodeJS.Process | undefined;
  const keyViaGlobal  = nodeEnv?.env?.["BRIEFING_API_KEY"];
  const keyViaProcess = process.env["BRIEFING_API_KEY"];
  const url = new URL(req.url);

  // ?debug=1 — 키 설정 여부 확인
  if (url.searchParams.get("debug") === "1") {
    return NextResponse.json({
      status:          "ok",
      key_via_global:  keyViaGlobal  ? `set (len=${keyViaGlobal.length})`  : "NOT SET",
      key_via_process: keyViaProcess ? `set (len=${keyViaProcess.length})` : "NOT SET",
    });
  }

  // ?inspect=ID — DB에 저장된 content_html 앞 2000자 확인 (진단용)
  const inspectId = url.searchParams.get("inspect");
  if (inspectId) {
    const db = createServerClient();
    const { data, error } = await db
      .from("briefings")
      .select("id, title, content_html")
      .eq("id", inspectId)
      .single();
    if (error || !data) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({
      id:    data.id,
      title: data.title,
      html_length:  data.content_html?.length ?? 0,
      html_preview: data.content_html?.slice(0, 2000) ?? "",
    });
  }

  return NextResponse.json({ status: "ok", endpoint: "POST /api/briefings/upload" });
}
