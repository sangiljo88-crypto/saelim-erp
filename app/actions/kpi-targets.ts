"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 타입 ─────────────────────────────────────────────────────
export interface KpiTarget {
  id?: string;
  dept: string;
  kpi_key: string;
  label: string;
  target_value: number;
  unit: string;
  year: number;
  quarter: number | null;
  updated_by: string | null;
  updated_at: string | null;
}

// ── 하드코딩 기본값 ─────────────────────────────────────────
const DEFAULT_TARGETS: Omit<KpiTarget, "id" | "year" | "quarter" | "updated_by" | "updated_at">[] = [
  // 전사
  { dept: "전사", kpi_key: "revenue",        label: "매출",         target_value: 1500000000, unit: "원/월" },
  { dept: "전사", kpi_key: "profit_margin",   label: "영업이익률",   target_value: 8,          unit: "%" },
  { dept: "전사", kpi_key: "cash_balance",    label: "현금잔고",     target_value: 500000000,  unit: "원" },
  { dept: "전사", kpi_key: "receivables",     label: "미수금",       target_value: 300000000,  unit: "원" },
  { dept: "전사", kpi_key: "claims",          label: "클레임",       target_value: 5,          unit: "건" },
  { dept: "전사", kpi_key: "yield",           label: "수율",         target_value: 92,         unit: "%" },
  // 생산팀
  { dept: "생산팀", kpi_key: "yield",         label: "수율",         target_value: 92,  unit: "%" },
  { dept: "생산팀", kpi_key: "daily_output",  label: "일 생산량",    target_value: 3000, unit: "kg" },
  { dept: "생산팀", kpi_key: "waste_rate",    label: "로스율",       target_value: 5,   unit: "%" },
  // 품질팀
  { dept: "품질팀", kpi_key: "claims",        label: "클레임",       target_value: 0,   unit: "건" },
  { dept: "품질팀", kpi_key: "patrol_pass",   label: "순찰 합격률",  target_value: 100, unit: "%" },
  { dept: "품질팀", kpi_key: "haccp_score",   label: "HACCP 점수",   target_value: 95,  unit: "점" },
  // 재고팀
  { dept: "재고팀", kpi_key: "accuracy",      label: "재고정확도",   target_value: 98,  unit: "%" },
  { dept: "재고팀", kpi_key: "turnover",      label: "재고회전율",   target_value: 12,  unit: "회" },
  // 가공팀
  { dept: "가공팀", kpi_key: "yield",         label: "수율",         target_value: 90,   unit: "%" },
  { dept: "가공팀", kpi_key: "daily_output",  label: "일 생산량",    target_value: 2000, unit: "kg" },
  // 스킨팀
  { dept: "스킨팀", kpi_key: "yield",         label: "수율",         target_value: 88,   unit: "%" },
  { dept: "스킨팀", kpi_key: "daily_output",  label: "일 생산량",    target_value: 1500, unit: "kg" },
  // 배송팀
  { dept: "배송팀", kpi_key: "on_time",       label: "정시 배송률",  target_value: 98,  unit: "%" },
  { dept: "배송팀", kpi_key: "return_rate",   label: "반품률",       target_value: 1,   unit: "%" },
  // CS팀
  { dept: "CS팀", kpi_key: "response_time",   label: "응답시간",     target_value: 2,   unit: "시간" },
  { dept: "CS팀", kpi_key: "resolution",      label: "해결률",       target_value: 95,  unit: "%" },
  // 마케팅팀
  { dept: "마케팅팀", kpi_key: "new_customers", label: "신규거래처",  target_value: 5,  unit: "건/월" },
  { dept: "마케팅팀", kpi_key: "retention",     label: "유지율",      target_value: 90, unit: "%" },
  // 회계팀
  { dept: "회계팀", kpi_key: "close_days",      label: "마감소요일",  target_value: 5,  unit: "일" },
  { dept: "회계팀", kpi_key: "ar_collection",   label: "매출채권회수율", target_value: 95, unit: "%" },
  // 개발팀
  { dept: "개발팀", kpi_key: "new_products",    label: "신제품",      target_value: 2, unit: "건/분기" },
  { dept: "개발팀", kpi_key: "cost_reduction",  label: "원가절감",    target_value: 3, unit: "%" },
  // 온라인팀
  { dept: "온라인팀", kpi_key: "order_growth",  label: "주문성장률",  target_value: 10, unit: "%/월" },
  { dept: "온라인팀", kpi_key: "conversion",    label: "전환율",      target_value: 3,  unit: "%" },
];

// ── 읽기: KPI 목표 조회 ─────────────────────────────────────
export async function getKpiTargets(
  year?: number,
  dept?: string
): Promise<KpiTarget[]> {
  const targetYear = year ?? new Date().getFullYear();

  try {
    const db = createServerClient();
    let query = db
      .from("kpi_targets")
      .select("id, dept, kpi_key, label, target_value, unit, year, quarter, updated_by, updated_at")
      .eq("year", targetYear)
      .is("quarter", null)
      .order("dept")
      .order("kpi_key");

    if (dept) {
      query = query.eq("dept", dept);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      // DB에 데이터 없으면 하드코딩 기본값 반환
      const defaults = dept
        ? DEFAULT_TARGETS.filter((d) => d.dept === dept)
        : DEFAULT_TARGETS;
      return defaults.map((d) => ({
        ...d,
        year: targetYear,
        quarter: null,
        updated_by: null,
        updated_at: null,
      }));
    }

    return data.map((row) => ({
      id: row.id as string,
      dept: row.dept as string,
      kpi_key: row.kpi_key as string,
      label: row.label as string,
      target_value: Number(row.target_value),
      unit: row.unit as string,
      year: row.year as number,
      quarter: row.quarter as number | null,
      updated_by: row.updated_by as string | null,
      updated_at: row.updated_at as string | null,
    }));
  } catch {
    // 테이블 없는 경우 기본값 반환
    const defaults = dept
      ? DEFAULT_TARGETS.filter((d) => d.dept === dept)
      : DEFAULT_TARGETS;
    return defaults.map((d) => ({
      ...d,
      year: targetYear,
      quarter: null,
      updated_by: null,
      updated_at: null,
    }));
  }
}

// ── 쓰기: 단건 upsert ──────────────────────────────────────
export async function upsertKpiTarget(
  dept: string,
  kpiKey: string,
  label: string,
  targetValue: number,
  unit: string,
  year: number,
  quarter?: number | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo" && session.role !== "ceo") {
      return { success: false, error: "COO/CEO만 KPI 목표를 수정할 수 있습니다" };
    }

    const db = createServerClient();
    const q = quarter ?? null;

    // quarter가 null인 경우 UNIQUE 제약이 안 먹으므로 수동으로 기존 행 찾기
    let existingQuery = db
      .from("kpi_targets")
      .select("id")
      .eq("dept", dept)
      .eq("kpi_key", kpiKey)
      .eq("year", year);

    if (q === null) {
      existingQuery = existingQuery.is("quarter", null);
    } else {
      existingQuery = existingQuery.eq("quarter", q);
    }

    const { data: existing } = await existingQuery.maybeSingle();

    const payload = {
      dept,
      kpi_key: kpiKey,
      label,
      target_value: targetValue,
      unit,
      year,
      quarter: q,
      updated_by: session.name,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (existing?.id) {
      // UPDATE
      ({ error } = await db.from("kpi_targets").update(payload).eq("id", existing.id));
    } else {
      // INSERT
      ({ error } = await db.from("kpi_targets").insert(payload));
    }

    if (error) return { success: false, error: error.message };

    revalidatePath("/settings/kpi");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

// ── 초기화: 기본값으로 시딩 ─────────────────────────────────
export async function initDefaultTargets(
  year: number
): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    const session = await getSession();
    if (!session) return { success: false, error: "로그인 필요" };
    if (session.role !== "coo" && session.role !== "ceo") {
      return { success: false, error: "COO/CEO만 초기화할 수 있습니다" };
    }

    const db = createServerClient();
    const now = new Date().toISOString();

    let count = 0;
    for (const d of DEFAULT_TARGETS) {
      const { data: existing } = await db
        .from("kpi_targets")
        .select("id")
        .eq("dept", d.dept)
        .eq("kpi_key", d.kpi_key)
        .eq("year", year)
        .is("quarter", null)
        .maybeSingle();

      const row = {
        dept: d.dept,
        kpi_key: d.kpi_key,
        label: d.label,
        target_value: d.target_value,
        unit: d.unit,
        year,
        quarter: null,
        updated_by: session.name,
        updated_at: now,
      };

      if (existing?.id) {
        await db.from("kpi_targets").update(row).eq("id", existing.id);
      } else {
        await db.from("kpi_targets").insert(row);
      }
      count++;
    }

    revalidatePath("/settings/kpi");
    revalidatePath("/dashboard");
    return { success: true, count };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}
