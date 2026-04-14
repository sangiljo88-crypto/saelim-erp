"use server";

import { createServerClient } from "@/lib/supabase";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ── 배차일지 생성 (출발 등록) ─────────────────────────────────
export async function createDispatchLog(data: {
  dispatch_date: string;
  vehicle_name: string;
  vehicle_number: string;
  start_mileage: number;
  destinations?: string;
  delivery_count?: number;
  start_time?: string;
  fuel_type?: string;
}) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const db = createServerClient();

  const { error } = await db.from("dispatch_logs").insert({
    dispatch_date: data.dispatch_date,
    vehicle_name: data.vehicle_name,
    vehicle_number: data.vehicle_number,
    driver_id: session.id,
    driver_name: session.name,
    dept: session.dept ?? "배송팀",
    start_mileage: data.start_mileage,
    destinations: data.destinations || null,
    delivery_count: data.delivery_count ?? 0,
    start_time: data.start_time || null,
    fuel_type: data.fuel_type || "경유",
    status: "departed",
  });

  if (error) {
    const msg = error.message.includes("does not exist")
      ? "dispatch_logs 테이블이 없습니다. Supabase에서 028_dispatch_log.sql을 실행해주세요."
      : error.message;
    return { success: false, error: msg };
  }

  revalidatePath("/dispatch");
  return { success: true };
}

// ── 배차 완료 (귀환 등록) ─────────────────────────────────────
export async function completeDispatchLog(
  logId: string,
  data: {
    end_mileage: number;
    end_time?: string;
    fuel_filled?: number;
    fuel_cost?: number;
    issues?: string;
  }
) {
  const session = await getSession();
  if (!session) return { success: false, error: "로그인 필요" };

  const db = createServerClient();

  // 기존 배차일지 확인
  const { data: existing, error: fetchError } = await db
    .from("dispatch_logs")
    .select("id, start_mileage, vehicle_number")
    .eq("id", logId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "배차일지를 찾을 수 없습니다." };
  }

  if (data.end_mileage <= Number(existing.start_mileage)) {
    return { success: false, error: "도착 키로수는 출발 키로수보다 커야 합니다." };
  }

  const { error } = await db
    .from("dispatch_logs")
    .update({
      end_mileage: data.end_mileage,
      end_time: data.end_time || null,
      fuel_filled: data.fuel_filled || null,
      fuel_cost: data.fuel_cost || null,
      issues: data.issues || null,
      status: "returned",
      updated_at: new Date().toISOString(),
    })
    .eq("id", logId);

  if (error) {
    return { success: false, error: error.message };
  }

  // 차량 마스터의 last_mileage 업데이트
  if (existing.vehicle_number) {
    await db
      .from("vehicles")
      .update({ last_mileage: data.end_mileage })
      .eq("vehicle_number", existing.vehicle_number);
  }

  revalidatePath("/dispatch");
  return { success: true };
}

// ── 오늘의 전체 배차 현황 ─────────────────────────────────────
export async function getTodayDispatches() {
  const db = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await db
    .from("dispatch_logs")
    .select("*")
    .eq("dispatch_date", today)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

// ── 내 배차일지 ───────────────────────────────────────────────
export async function getMyDispatches(daysBack = 30) {
  const session = await getSession();
  if (!session) return [];

  const db = createServerClient();
  const from = new Date();
  from.setDate(from.getDate() - daysBack);

  const { data, error } = await db
    .from("dispatch_logs")
    .select("*")
    .eq("driver_id", session.id)
    .gte("dispatch_date", from.toISOString().split("T")[0])
    .order("dispatch_date", { ascending: false });

  if (error) return [];
  return data ?? [];
}

// ── 기간별 배차 조회 ──────────────────────────────────────────
export async function getDispatchesByDate(dateFrom: string, dateTo: string) {
  const db = createServerClient();

  const { data, error } = await db
    .from("dispatch_logs")
    .select("*")
    .gte("dispatch_date", dateFrom)
    .lte("dispatch_date", dateTo)
    .order("dispatch_date", { ascending: false });

  if (error) return [];
  return data ?? [];
}

// ── 월간 유류비 요약 ──────────────────────────────────────────
const DEFAULT_DIESEL_PRICE = 1800; // 원/L

export async function getMonthlyFuelSummary(yearMonth: string) {
  const db = createServerClient();
  const [year, month] = yearMonth.split("-").map(Number);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const dateFrom = `${yearMonth}-01`;
  const dateTo = `${nextMonth}-01`;

  // 배차 데이터 조회
  const { data: dispatches } = await db
    .from("dispatch_logs")
    .select("vehicle_number, vehicle_name, distance_km, fuel_filled, fuel_cost, status")
    .gte("dispatch_date", dateFrom)
    .lt("dispatch_date", dateTo)
    .eq("status", "returned");

  // 차량 마스터 조회
  const { data: vehicleList } = await db
    .from("vehicles")
    .select("vehicle_number, vehicle_name, fuel_efficiency, fuel_type")
    .eq("is_active", true);

  const vehicleMap = new Map(
    (vehicleList ?? []).map((v) => [v.vehicle_number, v])
  );

  // 차량별 집계
  const summaryMap = new Map<
    string,
    {
      vehicle_number: string;
      vehicle_name: string;
      total_km: number;
      total_fuel_cost: number;
      fuel_filled_total: number;
      trip_count: number;
      fuel_efficiency: number;
    }
  >();

  for (const d of dispatches ?? []) {
    const key = d.vehicle_number || d.vehicle_name;
    const existing = summaryMap.get(key) ?? {
      vehicle_number: d.vehicle_number ?? "",
      vehicle_name: d.vehicle_name ?? "",
      total_km: 0,
      total_fuel_cost: 0,
      fuel_filled_total: 0,
      trip_count: 0,
      fuel_efficiency: vehicleMap.get(d.vehicle_number)?.fuel_efficiency ?? 8.0,
    };

    existing.total_km += Number(d.distance_km ?? 0);
    existing.total_fuel_cost += Number(d.fuel_cost ?? 0);
    existing.fuel_filled_total += Number(d.fuel_filled ?? 0);
    existing.trip_count += 1;

    summaryMap.set(key, existing);
  }

  // 추정 유류비 계산 추가
  const result = Array.from(summaryMap.values()).map((s) => ({
    ...s,
    estimated_fuel_cost: Math.round(
      (s.total_km / s.fuel_efficiency) * DEFAULT_DIESEL_PRICE
    ),
    actual_fuel_efficiency:
      s.fuel_filled_total > 0
        ? Math.round((s.total_km / s.fuel_filled_total) * 10) / 10
        : null,
  }));

  return result;
}

// ── 차량 목록 ─────────────────────────────────────────────────
export async function getVehicles() {
  const db = createServerClient();

  const { data, error } = await db
    .from("vehicles")
    .select("*")
    .eq("is_active", true)
    .order("vehicle_name");

  if (error) return [];
  return data ?? [];
}

// ── 차량 추가/수정 ────────────────────────────────────────────
export async function upsertVehicle(data: {
  id?: string;
  vehicle_name: string;
  vehicle_number: string;
  vehicle_type?: string;
  capacity_ton?: number;
  fuel_type?: string;
  fuel_efficiency?: number;
  notes?: string;
}) {
  const session = await getSession();
  if (!session || (session.role !== "coo" && session.role !== "ceo" && session.role !== "manager")) {
    return { success: false, error: "권한이 없습니다." };
  }

  const db = createServerClient();

  if (data.id) {
    const { error } = await db
      .from("vehicles")
      .update({
        vehicle_name: data.vehicle_name,
        vehicle_number: data.vehicle_number,
        vehicle_type: data.vehicle_type || "냉동",
        capacity_ton: data.capacity_ton || null,
        fuel_type: data.fuel_type || "경유",
        fuel_efficiency: data.fuel_efficiency || 8.0,
        notes: data.notes || null,
      })
      .eq("id", data.id);

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await db.from("vehicles").insert({
      vehicle_name: data.vehicle_name,
      vehicle_number: data.vehicle_number,
      vehicle_type: data.vehicle_type || "냉동",
      capacity_ton: data.capacity_ton || null,
      fuel_type: data.fuel_type || "경유",
      fuel_efficiency: data.fuel_efficiency || 8.0,
      notes: data.notes || null,
    });

    if (error) {
      const msg = error.message.includes("does not exist")
        ? "vehicles 테이블이 없습니다. Supabase에서 028_dispatch_log.sql을 실행해주세요."
        : error.message.includes("duplicate")
          ? "이미 등록된 차량번호입니다."
          : error.message;
      return { success: false, error: msg };
    }
  }

  revalidatePath("/dispatch");
  revalidatePath("/dispatch/fuel");
  return { success: true };
}

// ── 차량별 키로수 이력 ────────────────────────────────────────
export async function getVehicleMileageHistory(vehicleNumber: string, months = 6) {
  const db = createServerClient();
  const from = new Date();
  from.setMonth(from.getMonth() - months);

  const { data, error } = await db
    .from("dispatch_logs")
    .select("dispatch_date, start_mileage, end_mileage, distance_km")
    .eq("vehicle_number", vehicleNumber)
    .eq("status", "returned")
    .gte("dispatch_date", from.toISOString().split("T")[0])
    .order("dispatch_date", { ascending: true });

  if (error) return [];
  return data ?? [];
}
