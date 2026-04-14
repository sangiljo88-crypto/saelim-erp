"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 납품전표 제출 ────────────────────────────────────────────
export async function submitDelivery(
  formData: FormData,
  items: Array<{ product: string; qty_kg: number; unit_price: number; amount: number }>
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  // 금액 음수 검증
  const hasNegative = items.some((it) => it.qty_kg < 0 || it.unit_price < 0 || it.amount < 0);
  if (hasNegative) return { success: false, error: "수량·단가·금액은 0 이상이어야 합니다." };

  const totalAmount = items.reduce((s, it) => s + it.amount, 0);
  const db = createServerClient();

  const customerName = formData.get("customer_name") as string;
  const customerId   = (formData.get("customer_id") as string) || null;

  const { error } = await db.from("deliveries").insert({
    delivery_date: formData.get("delivery_date"),
    customer_name: customerName,
    customer_id:   customerId || undefined,
    dept:          session.dept ?? "배송팀",
    items,
    total_amount:  totalAmount,
    status:        "shipped",
    driver:        (formData.get("driver") as string) || null,
    notes:         (formData.get("notes") as string) || null,
  });

  if (error) {
    const msg = error.message.includes("does not exist")
      ? "deliveries 테이블이 없습니다. Supabase에서 schema_v4.sql을 실행해주세요."
      : error.message;
    return { success: false, error: msg };
  }

  // ── CEO 매출 KPI 자동 동기화 ──────────────────────────────
  // 납품전표 저장 즉시 해당 월의 monthly_kpi(revenue) 재집계
  try {
    const deliveryDate = (formData.get("delivery_date") as string) ?? new Date().toISOString().split("T")[0];
    const yearMonth = deliveryDate.slice(0, 7);
    const nextYM = (() => {
      const [y, m] = yearMonth.split("-").map(Number);
      return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    })();

    const { data: monthRows } = await db
      .from("deliveries")
      .select("total_amount")
      .gte("delivery_date", `${yearMonth}-01`)
      .lt("delivery_date", `${nextYM}-01`);

    const monthRevenue = (monthRows ?? []).reduce((s, d) => s + (d.total_amount || 0), 0);

    await db.from("monthly_kpi").upsert(
      {
        year_month: yearMonth,
        dept:       "전사",
        kpi_key:    "revenue",
        actual:     monthRevenue,
        target:     1_500_000_000, // 월 목표 15억 (연 180억 기준)
      },
      { onConflict: "year_month,dept,kpi_key" }
    );
  } catch {
    // KPI 동기화 실패는 납품 저장 결과에 영향 주지 않음
  }

  try { revalidatePath("/team"); revalidatePath("/dashboard"); } catch {}
  return { success: true };
}

// ── 거래처 저장 ────────────────────────────────────────────────
export async function saveCustomer(formData: FormData) {
  const session = await getSession();
  if (!session) throw new Error("로그인 필요");

  const db = createServerClient();
  const productsRaw = (formData.get("products") as string) || "";
  const products = productsRaw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const { error } = await db.from("customers").insert({
    name:          formData.get("name") as string,
    type:          (formData.get("type") as string) || "식당",
    contact_name:  (formData.get("contact_name") as string) || null,
    phone:         (formData.get("phone") as string) || null,
    address:       (formData.get("address") as string) || null,
    tax_id:        (formData.get("tax_id") as string) || null,
    credit_limit:  Number(formData.get("credit_limit")) || 0,
    payment_terms: Number(formData.get("payment_terms")) || 30,
    products:      products.length > 0 ? products : null,
    monthly_avg:   Number(formData.get("monthly_avg")) || 0,
    memo:          (formData.get("memo") as string) || null,
    active:        true,
  });

  if (error) throw new Error(error.message);
  revalidatePath("/team");
  return { success: true };
}
