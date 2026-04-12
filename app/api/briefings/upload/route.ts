import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

// 빌드 시점 최적화 방지 — 환경변수를 항상 런타임에 읽도록 강제
export const dynamic = "force-dynamic";

function stripHljsSpans(html: string): string {
  return html
    .replace(/<span\s+class="hljs-[^"]*"[^>]*>/g, "")
    .replace(/<span\s+class="language-[^"]*"[^>]*>/g, "")
    .replace(/<\/span>/g, "");
}

export async function POST(req: NextRequest) {
  // ── API Key 인증 ──────────────────────────────────────────────
  // 브래킷 표기법 — Next.js 빌드 시점 인라인 방지
  const apiKey = process.env["BRIEFING_API_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "서버 설정 오류: BRIEFING_API_KEY 미설정" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const providedKey = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (providedKey !== apiKey) {
    return NextResponse.json({ error: "인증 실패: API Key가 올바르지 않습니다" }, { status: 401 });
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

  // ── hljs 태그 제거 ───────────────────────────────────────────
  const cleanedHtml = stripHljsSpans(String(content_html));

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

// GET 요청 — 헬스체크
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "POST /api/briefings/upload" });
}
