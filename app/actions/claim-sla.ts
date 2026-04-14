"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── SLA 필드 업데이트 ────────────────────────────────────────
export async function updateClaimSla(
  claimId: string,
  updates: {
    first_response_at?: string;
    resolved_at?: string;
    compensation_type?: string;
    compensation_amount?: number;
  }
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const allowed =
    session.role === "coo" ||
    session.role === "ceo" ||
    (session.role === "manager" && ["CS팀", "품질팀"].includes(session.dept ?? ""));
  if (!allowed) return { success: false, error: "권한 없음" };

  const db = createServerClient();
  const { error } = await db
    .from("claims")
    .update(updates)
    .eq("id", claimId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/claims");
  revalidatePath("/claims/sla");
  return { success: true };
}

// ── 소통 이력 추가 (communication_log 배열에 append) ─────────
export async function addCommunicationLog(
  claimId: string,
  entry: { type: string; content: string }
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const db = createServerClient();

  // 기존 로그 조회
  const { data: claim, error: fetchErr } = await db
    .from("claims")
    .select("communication_log")
    .eq("id", claimId)
    .single();

  if (fetchErr) return { success: false, error: fetchErr.message };

  const existingLog = Array.isArray(claim?.communication_log)
    ? claim.communication_log
    : [];

  const newEntry = {
    date: new Date().toISOString(),
    type: entry.type,
    content: entry.content,
    by: session.name,
  };

  const { error } = await db
    .from("claims")
    .update({ communication_log: [...existingLog, newEntry] })
    .eq("id", claimId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/claims");
  return { success: true, entry: newEntry };
}

// ── SLA 통계 집계 ────────────────────────────────────────────
export async function getClaimSlaStats(dateFrom?: string, dateTo?: string) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  let query = db
    .from("claims")
    .select("created_at, first_response_at, resolved_at, compensation_amount, status");

  if (dateFrom) query = query.gte("claim_date", dateFrom);
  if (dateTo) query = query.lte("claim_date", dateTo);

  const { data: claims, error } = await query;
  if (error) throw new Error(error.message);

  const all = claims ?? [];

  // 평균 1차 응답시간 (시간 단위)
  const responseTimes: number[] = [];
  for (const c of all) {
    if (c.first_response_at && c.created_at) {
      const diff =
        new Date(c.first_response_at).getTime() - new Date(c.created_at).getTime();
      responseTimes.push(diff / (1000 * 60 * 60)); // hours
    }
  }

  // 평균 해결시간 (시간 단위)
  const resolutionTimes: number[] = [];
  for (const c of all) {
    if (c.resolved_at && c.created_at) {
      const diff =
        new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime();
      resolutionTimes.push(diff / (1000 * 60 * 60)); // hours
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const compensationTotal = all.reduce(
    (s, c) => s + (Number(c.compensation_amount) || 0),
    0
  );

  return {
    avgResponseHours: Math.round(avg(responseTimes) * 10) / 10,
    avgResolutionHours: Math.round(avg(resolutionTimes) * 10) / 10,
    compensationTotal,
    totalClaims: all.length,
    resolvedCount: all.filter((c) => c.status === "resolved").length,
  };
}

// ── 패턴 분석: 반복 클레임 품목 ─────────────────────────────
export async function getClaimPatterns(months?: number) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const period = months ?? 3;
  const since = new Date();
  since.setMonth(since.getMonth() - period);
  const sinceStr = since.toISOString().split("T")[0];

  const db = createServerClient();
  const { data: claims, error } = await db
    .from("claims")
    .select("product_names, claim_type, root_cause, claim_date")
    .gte("claim_date", sinceStr);

  if (error) throw new Error(error.message);

  // product_name별 집계
  const productMap: Record<
    string,
    { count: number; recentMonths: number; causes: Record<string, number> }
  > = {};

  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  for (const c of claims ?? []) {
    const names: string[] = Array.isArray(c.product_names)
      ? c.product_names
      : [];
    for (const name of names) {
      if (!productMap[name]) {
        productMap[name] = { count: 0, recentMonths: 0, causes: {} };
      }
      productMap[name].count++;

      if (c.claim_date && new Date(c.claim_date) >= threeMonthsAgo) {
        productMap[name].recentMonths++;
      }

      const cause = c.claim_type || c.root_cause || "미분류";
      productMap[name].causes[cause] = (productMap[name].causes[cause] || 0) + 1;
    }
  }

  const patterns = Object.entries(productMap)
    .map(([name, data]) => {
      const topCause = Object.entries(data.causes).sort(
        (a, b) => b[1] - a[1]
      )[0];
      return {
        productName: name,
        totalCount: data.count,
        recentMonthsCount: data.recentMonths,
        topCause: topCause ? topCause[0] : "-",
        isRepeatOffender: data.recentMonths >= 3,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount);

  return patterns;
}
