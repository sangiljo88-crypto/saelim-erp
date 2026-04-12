import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import AccountingManager from "@/components/AccountingManager";
import { createServerClient } from "@/lib/supabase";

interface Props {
  searchParams: Promise<{ from?: string; to?: string; tab?: string }>;
}

export default async function AccountingPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "coo" && session.role !== "ceo") redirect("/dashboard");

  const params = await searchParams;
  const today         = new Date().toISOString().split("T")[0];
  const firstOfMonth  = today.slice(0, 7) + "-01";

  const from = params.from || firstOfMonth;
  const to   = params.to   || today;
  const tab  = params.tab  || "cashflow";

  const db = createServerClient();

  const [
    { data: cashFlows },
    { data: payments },
    { data: purchases },
    { data: payrollRows },
  ] = await Promise.all([
    // 현금흐름 원장
    db.from("cash_flow_ledger")
      .select("id, transaction_date, flow_type, category, amount, supply_amount, vat_amount, counterparty, payment_method, description, is_vat_deductible, ref_type, recorded_by, created_at")
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date", { ascending: false })
      .order("created_at",       { ascending: false }),

    // 매입 결제 내역
    db.from("purchase_payments")
      .select("id, purchase_id, payment_date, supplier, amount, supply_amount, vat_amount, payment_method, bank_account, is_tax_invoice, tax_invoice_no, memo, recorded_by, created_at")
      .gte("payment_date", from)
      .lte("payment_date", to)
      .order("payment_date", { ascending: false }),

    // 미결제 매입 (최근 90일)
    db.from("material_purchases")
      .select("id, purchase_date, material_name, supplier, total_cost, invoice_no")
      .gte("purchase_date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])
      .order("purchase_date", { ascending: false }),

    // 이번달 급여 (현금흐름 참고용)
    db.from("payroll_records")
      .select("year_month, total_pay")
      .eq("year_month", today.slice(0, 7)),
  ]);

  const flows     = cashFlows  ?? [];
  const pymts     = payments   ?? [];
  const purcs     = purchases  ?? [];
  const payrolls  = payrollRows ?? [];

  // 기간 합계
  const totalInflow   = flows.filter((f) => f.flow_type === "inflow").reduce((s, f) => s + f.amount, 0);
  const totalOutflow  = flows.filter((f) => f.flow_type === "outflow").reduce((s, f) => s + f.amount, 0);
  const netCashFlow   = totalInflow - totalOutflow;

  // 부가세 집계 (이번달 기준)
  const vatCollected  = flows.filter((f) => f.flow_type === "inflow").reduce((s, f) => s + (f.vat_amount || 0), 0);
  const vatDeductible = flows.filter((f) => f.is_vat_deductible).reduce((s, f) => s + (f.vat_amount || 0), 0);
  const vatPayable    = vatCollected - vatDeductible;

  // 이번달 급여 합계
  const totalPayroll = payrolls.reduce((s, r) => s + (r.total_pay || 0), 0);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      <AppHeader session={session} subtitle="회계 관리" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-5">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-800">🧾 회계 관리</h1>
            <p className="text-sm text-gray-500 mt-0.5">현금흐름 · 매입결제 · 부가세 관리 · 손익 분석</p>
          </div>
          <div className="flex gap-3 text-right">
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 text-center">
              <div className="text-xs text-gray-400">순현금흐름</div>
              <div className={`text-lg font-bold ${netCashFlow >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {netCashFlow >= 0 ? "+" : ""}{(netCashFlow / 10000).toLocaleString()}만원
              </div>
            </div>
            {vatPayable !== 0 && (
              <div className="bg-white rounded-xl border border-gray-200 px-4 py-2 text-center">
                <div className="text-xs text-gray-400">부가세 납부예상</div>
                <div className={`text-lg font-bold ${vatPayable >= 0 ? "text-orange-500" : "text-emerald-600"}`}>
                  {(vatPayable / 10000).toLocaleString()}만원
                </div>
              </div>
            )}
          </div>
        </div>

        <AccountingManager
          cashFlows={flows}
          payments={pymts}
          purchases={purcs}
          totalInflow={totalInflow}
          totalOutflow={totalOutflow}
          vatCollected={vatCollected}
          vatDeductible={vatDeductible}
          vatPayable={vatPayable}
          totalPayroll={totalPayroll}
          initialFrom={from}
          initialTo={to}
          initialTab={tab}
        />
      </main>
    </div>
  );
}
