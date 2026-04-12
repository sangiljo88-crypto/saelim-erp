"use client";

import React, { useState, useTransition } from "react";
import { recordPurchasePayment, recordCashFlow } from "@/app/actions/submit";

interface CashFlow {
  id: string;
  transaction_date: string;
  flow_type: string;
  category: string;
  amount: number;
  supply_amount: number | null;
  vat_amount: number | null;
  counterparty: string | null;
  payment_method: string | null;
  description: string | null;
  is_vat_deductible: boolean | null;
  ref_type: string | null;
  recorded_by: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  purchase_id: string | null;
  payment_date: string;
  supplier: string | null;
  amount: number;
  supply_amount: number | null;
  vat_amount: number | null;
  payment_method: string | null;
  bank_account: string | null;
  is_tax_invoice: boolean | null;
  tax_invoice_no: string | null;
  memo: string | null;
  recorded_by: string | null;
  created_at: string;
}

interface Purchase {
  id: string;
  purchase_date: string;
  material_name: string;
  supplier: string | null;
  total_cost: number;
  invoice_no: string | null;
}

interface Props {
  cashFlows:      CashFlow[];
  payments:       Payment[];
  purchases:      Purchase[];
  totalInflow:    number;
  totalOutflow:   number;
  vatCollected:   number;
  vatDeductible:  number;
  vatPayable:     number;
  totalPayroll:   number;
  initialFrom:    string;
  initialTo:      string;
  initialTab:     string;
}

const CATEGORIES_INFLOW  = ["매출입금", "기타수입"];
const CATEGORIES_OUTFLOW = ["매입결제", "급여", "경비", "세금·공과금", "유틸리티", "기타지출"];
const PAYMENT_METHODS    = ["계좌이체", "현금", "법인카드", "개인카드", "어음", "기타"];

const FLOW_TABS = [
  { key: "cashflow",  label: "💰 현금흐름",     },
  { key: "payments",  label: "🏷️ 매입결제",      },
  { key: "unpaid",    label: "⚠️ 미결제 현황",   },
  { key: "vat",       label: "📋 부가세 관리",   },
];

const CATEGORY_COLOR: Record<string, string> = {
  "매출입금":    "bg-emerald-100 text-emerald-700",
  "기타수입":    "bg-teal-100 text-teal-700",
  "매입결제":    "bg-red-100 text-red-700",
  "급여":        "bg-purple-100 text-purple-700",
  "경비":        "bg-orange-100 text-orange-700",
  "세금·공과금": "bg-yellow-100 text-yellow-700",
  "유틸리티":    "bg-blue-100 text-blue-700",
  "기타지출":    "bg-gray-100 text-gray-700",
};

const EMPTY_FLOW_FORM = {
  transaction_date:  "",
  flow_type:         "outflow" as "inflow" | "outflow",
  category:          "매입결제",
  amount:            0,
  supply_amount:     0,
  vat_amount:        0,
  counterparty:      "",
  payment_method:    "계좌이체",
  description:       "",
  is_vat_deductible: false,
};

const EMPTY_PAYMENT_FORM = {
  purchase_id:    "",
  payment_date:   "",
  supplier:       "",
  amount:         0,
  supply_amount:  0,
  vat_amount:     0,
  payment_method: "계좌이체",
  bank_account:   "",
  is_tax_invoice: false,
  tax_invoice_no: "",
  memo:           "",
};

export default function AccountingManager({
  cashFlows: initialFlows,
  payments:  initialPayments,
  purchases,
  totalInflow,
  totalOutflow,
  vatCollected,
  vatDeductible,
  vatPayable,
  totalPayroll,
  initialFrom,
  initialTo,
  initialTab,
}: Props) {
  const [from,  setFrom]  = useState(initialFrom);
  const [to,    setTo]    = useState(initialTo);
  const [tab,   setTab]   = useState(initialTab);

  const [flows,    setFlows]    = useState<CashFlow[]>(initialFlows);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);

  const [showFlowForm,    setShowFlowForm]    = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const [flowForm,    setFlowForm]    = useState({ ...EMPTY_FLOW_FORM });
  const [paymentForm, setPaymentForm] = useState({ ...EMPTY_PAYMENT_FORM });

  const [isPending, startTransition] = useTransition();
  const [msg,  setMsg]  = useState("");
  const [err,  setErr]  = useState("");

  const today = new Date().toISOString().split("T")[0];

  // 수량 × 10% 부가세 자동계산
  function applySupply<T extends { supply_amount: number; vat_amount: number; amount: number }>(
    value: number,
    setter: React.Dispatch<React.SetStateAction<T>>
  ) {
    setter((prev) => ({
      ...prev,
      supply_amount: value,
      vat_amount:    Math.round(value * 0.1),
      amount:        value + Math.round(value * 0.1),
    }));
  }

  function handleSaveFlow(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setErr("");
    startTransition(async () => {
      const res = await recordCashFlow(flowForm);
      if (res?.error) { setErr(res.error); return; }
      const newFlow: CashFlow = {
        id:               crypto.randomUUID(),
        transaction_date: flowForm.transaction_date,
        flow_type:        flowForm.flow_type,
        category:         flowForm.category,
        amount:           flowForm.amount,
        supply_amount:    flowForm.supply_amount,
        vat_amount:       flowForm.vat_amount,
        counterparty:     flowForm.counterparty || null,
        payment_method:   flowForm.payment_method,
        description:      flowForm.description || null,
        is_vat_deductible: flowForm.is_vat_deductible,
        ref_type:         null,
        recorded_by:      "방금 저장됨",
        created_at:       new Date().toISOString(),
      };
      setFlows((prev) => [newFlow, ...prev]);
      setFlowForm({ ...EMPTY_FLOW_FORM, transaction_date: today });
      setShowFlowForm(false);
      setMsg("✅ 현금흐름 항목 저장 완료");
    });
  }

  function handleSavePayment(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setErr("");
    startTransition(async () => {
      const res = await recordPurchasePayment({
        ...paymentForm,
        purchase_id: paymentForm.purchase_id || undefined,
      });
      if (res?.error) { setErr(res.error); return; }
      const newPayment: Payment = {
        id:             crypto.randomUUID(),
        purchase_id:    paymentForm.purchase_id || null,
        payment_date:   paymentForm.payment_date,
        supplier:       paymentForm.supplier || null,
        amount:         paymentForm.amount,
        supply_amount:  paymentForm.supply_amount,
        vat_amount:     paymentForm.vat_amount,
        payment_method: paymentForm.payment_method,
        bank_account:   paymentForm.bank_account || null,
        is_tax_invoice: paymentForm.is_tax_invoice,
        tax_invoice_no: paymentForm.tax_invoice_no || null,
        memo:           paymentForm.memo || null,
        recorded_by:    "방금 저장됨",
        created_at:     new Date().toISOString(),
      };
      setPayments((prev) => [newPayment, ...prev]);
      setPaymentForm({ ...EMPTY_PAYMENT_FORM, payment_date: today });
      setShowPaymentForm(false);
      setMsg("✅ 매입 결제 등록 완료 (현금흐름 자동 반영)");
    });
  }

  // 미결제 매입 (purchases 중 payments에서 확인)
  const paidPurchaseIds = new Set(payments.filter((p) => p.purchase_id).map((p) => p.purchase_id!));
  const unpaidPurchases = purchases.filter((p) => !paidPurchaseIds.has(p.id));

  return (
    <div className="flex flex-col gap-5">

      {/* 기간 필터 */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-600">기간 조회</span>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
        <span className="text-xs text-gray-400">~</span>
        <input type="date" value={to}   onChange={(e) => setTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
        <button
          onClick={() => window.location.href = `/accounting?from=${from}&to=${to}&tab=${tab}`}
          className="bg-[#1F3864] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#2a4a7f] cursor-pointer"
        >조회</button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">총 입금</div>
          <div className="text-xl font-bold text-emerald-600">
            {(totalInflow / 10000).toLocaleString()}만원
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">총 출금</div>
          <div className="text-xl font-bold text-red-500">
            {(totalOutflow / 10000).toLocaleString()}만원
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">미결제 매입</div>
          <div className="text-xl font-bold text-orange-500">
            {unpaidPurchases.length}건
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {(unpaidPurchases.reduce((s, p) => s + p.total_cost, 0) / 10000).toLocaleString()}만원
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">부가세 납부예상</div>
          <div className={`text-xl font-bold ${vatPayable >= 0 ? "text-orange-500" : "text-emerald-600"}`}>
            {(vatPayable / 10000).toLocaleString()}만원
          </div>
          <div className="text-xs text-gray-400 mt-0.5">매출세 - 매입세</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 overflow-x-auto bg-white rounded-xl border border-gray-200 px-2 py-2">
        {FLOW_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap transition-colors cursor-pointer",
              tab === t.key
                ? "bg-[#1F3864] text-white"
                : "text-gray-500 hover:bg-gray-100",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 메시지 */}
      {msg  && <div className="text-sm text-emerald-600 font-medium">{msg}</div>}
      {err  && <div className="text-sm text-red-500">{err}</div>}

      {/* ── TAB: 현금흐름 ──────────────────────────────────── */}
      {tab === "cashflow" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">현금흐름 원장</span>
            <button
              onClick={() => {
                setShowFlowForm(!showFlowForm);
                setFlowForm({ ...EMPTY_FLOW_FORM, transaction_date: today });
                setMsg(""); setErr("");
              }}
              className="text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2a4a7f] cursor-pointer"
            >
              {showFlowForm ? "✕ 취소" : "+ 항목 등록"}
            </button>
          </div>

          {showFlowForm && (
            <form onSubmit={handleSaveFlow}
              className="bg-white border border-[#1F3864]/20 rounded-xl px-5 py-4 flex flex-col gap-4">
              <div className="text-sm font-bold text-[#1F3864]">💰 현금흐름 항목 등록</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">거래일 *</label>
                  <input type="date" value={flowForm.transaction_date}
                    onChange={(e) => setFlowForm((p) => ({ ...p, transaction_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">유형 *</label>
                  <div className="flex gap-2">
                    {(["inflow", "outflow"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setFlowForm((p) => ({
                          ...p,
                          flow_type: t,
                          category: t === "inflow" ? "매출입금" : "매입결제",
                        }))}
                        className={[
                          "flex-1 py-1.5 text-sm font-semibold rounded-lg border transition cursor-pointer",
                          flowForm.flow_type === t
                            ? t === "inflow"
                              ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                              : "bg-red-50 border-red-400 text-red-700"
                            : "border-gray-200 text-gray-400 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {t === "inflow" ? "↑ 입금" : "↓ 출금"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">분류 *</label>
                  <select value={flowForm.category}
                    onChange={(e) => setFlowForm((p) => ({ ...p, category: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30">
                    {(flowForm.flow_type === "inflow" ? CATEGORIES_INFLOW : CATEGORIES_OUTFLOW).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">거래처/지급처</label>
                  <input type="text" value={flowForm.counterparty}
                    onChange={(e) => setFlowForm((p) => ({ ...p, counterparty: e.target.value }))}
                    placeholder="거래처명"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공급가액 (원)</label>
                  <input type="number" value={flowForm.supply_amount || ""}
                    onChange={(e) => applySupply(Number(e.target.value) || 0, setFlowForm)}
                    placeholder="부가세 제외 금액"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                  <div className="text-xs text-gray-400 mt-0.5">
                    → 부가세 {(flowForm.vat_amount).toLocaleString()}원 자동계산
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">결제금액 (원) *</label>
                  <input type="number" value={flowForm.amount || ""}
                    onChange={(e) => setFlowForm((p) => ({ ...p, amount: Number(e.target.value) || 0 }))}
                    placeholder="부가세 포함 총액"
                    min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">결제수단</label>
                  <select value={flowForm.payment_method}
                    onChange={(e) => setFlowForm((p) => ({ ...p, payment_method: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30">
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="checkbox" id="vat_ded"
                    checked={flowForm.is_vat_deductible}
                    onChange={(e) => setFlowForm((p) => ({ ...p, is_vat_deductible: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="vat_ded" className="text-xs text-gray-600 cursor-pointer">
                    매입세액공제 가능 (세금계산서 수취)
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">설명/메모</label>
                  <input type="text" value={flowForm.description}
                    onChange={(e) => setFlowForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="거래 내용 메모"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                </div>
              </div>
              <button type="submit" disabled={isPending}
                className="self-start bg-[#1F3864] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer">
                {isPending ? "저장중…" : "💾 저장"}
              </button>
            </form>
          )}

          {/* 현금흐름 목록 */}
          {flows.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              해당 기간에 등록된 현금흐름 내역이 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs">
                    <th className="px-4 py-3 text-left font-semibold">거래일</th>
                    <th className="px-3 py-3 text-left font-semibold">유형</th>
                    <th className="px-3 py-3 text-left font-semibold">분류</th>
                    <th className="px-3 py-3 text-left font-semibold">거래처</th>
                    <th className="px-3 py-3 text-right font-semibold">공급가액</th>
                    <th className="px-3 py-3 text-right font-semibold">부가세</th>
                    <th className="px-3 py-3 text-right font-semibold">결제금액</th>
                    <th className="px-3 py-3 text-left font-semibold">수단</th>
                    <th className="px-3 py-3 text-left font-semibold">세공제</th>
                  </tr>
                </thead>
                <tbody>
                  {flows.map((f) => (
                    <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{f.transaction_date}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          f.flow_type === "inflow" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}>
                          {f.flow_type === "inflow" ? "↑ 입금" : "↓ 출금"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLOR[f.category] ?? "bg-gray-100 text-gray-600"}`}>
                          {f.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700 max-w-[120px] truncate">
                        {f.counterparty ?? "-"}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-gray-500">
                        {(f.supply_amount ?? 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-xs text-right text-orange-500">
                        {(f.vat_amount ?? 0).toLocaleString()}
                      </td>
                      <td className={`px-3 py-2 text-sm text-right font-bold whitespace-nowrap ${
                        f.flow_type === "inflow" ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {f.flow_type === "inflow" ? "+" : "-"}{f.amount.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{f.payment_method ?? "-"}</td>
                      <td className="px-3 py-2 text-center">
                        {f.is_vat_deductible ? (
                          <span className="text-xs text-emerald-500">✓</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-700 border-t-2 border-gray-200">
                    <td className="px-4 py-3 text-xs" colSpan={4}>합계</td>
                    <td className="px-3 py-3 text-xs text-right text-gray-500">
                      {flows.reduce((s, f) => s + (f.supply_amount ?? 0), 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-orange-500">
                      {flows.reduce((s, f) => s + (f.vat_amount ?? 0), 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-sm whitespace-nowrap">
                      <span className="text-emerald-600">
                        +{flows.filter((f) => f.flow_type === "inflow").reduce((s, f) => s + f.amount, 0).toLocaleString()}
                      </span>
                      {" / "}
                      <span className="text-red-500">
                        -{flows.filter((f) => f.flow_type === "outflow").reduce((s, f) => s + f.amount, 0).toLocaleString()}
                      </span>
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: 매입결제 ──────────────────────────────────── */}
      {tab === "payments" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-600">매입 결제 내역</span>
            <button
              onClick={() => {
                setShowPaymentForm(!showPaymentForm);
                setPaymentForm({ ...EMPTY_PAYMENT_FORM, payment_date: today });
                setMsg(""); setErr("");
              }}
              className="text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2a4a7f] cursor-pointer"
            >
              {showPaymentForm ? "✕ 취소" : "+ 결제 등록"}
            </button>
          </div>

          {showPaymentForm && (
            <form onSubmit={handleSavePayment}
              className="bg-white border border-[#1F3864]/20 rounded-xl px-5 py-4 flex flex-col gap-4">
              <div className="text-sm font-bold text-[#1F3864]">🏷️ 매입 결제 등록</div>
              <div className="text-xs text-gray-500">
                결제 등록 시 현금흐름 원장(매입결제)에 자동 반영됩니다
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">결제일 *</label>
                  <input type="date" value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, payment_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">연결 매입 건 (선택)</label>
                  <select value={paymentForm.purchase_id}
                    onChange={(e) => {
                      const id = e.target.value;
                      const p  = purchases.find((x) => x.id === id);
                      setPaymentForm((prev) => ({
                        ...prev,
                        purchase_id:   id,
                        supplier:      p?.supplier ?? prev.supplier,
                        amount:        p?.total_cost ?? prev.amount,
                        supply_amount: p ? Math.round(p.total_cost / 1.1) : prev.supply_amount,
                        vat_amount:    p ? p.total_cost - Math.round(p.total_cost / 1.1) : prev.vat_amount,
                      }));
                    }}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30">
                    <option value="">-- 미결제 매입 선택 --</option>
                    {purchases.filter((p) => !paidPurchaseIds.has(p.id)).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.purchase_date} {p.material_name} ({p.supplier ?? "공급처미상"}) · {(p.total_cost / 10000).toFixed(1)}만원
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공급업체 *</label>
                  <input type="text" value={paymentForm.supplier}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, supplier: e.target.value }))}
                    placeholder="공급업체명"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공급가액 (원)</label>
                  <input type="number" value={paymentForm.supply_amount || ""}
                    onChange={(e) => applySupply(Number(e.target.value) || 0, setPaymentForm)}
                    placeholder="부가세 별도 금액"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                  <div className="text-xs text-gray-400 mt-0.5">
                    → 부가세 {paymentForm.vat_amount.toLocaleString()}원 자동계산
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">결제금액 (원) *</label>
                  <input type="number" value={paymentForm.amount || ""}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, amount: Number(e.target.value) || 0 }))}
                    placeholder="부가세 포함 총액"
                    min={1}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">결제수단</label>
                  <select value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, payment_method: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30">
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">계좌/카드 번호</label>
                  <input type="text" value={paymentForm.bank_account}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, bank_account: e.target.value }))}
                    placeholder="ex) 국민 1234, 법인카드 5678"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">세금계산서 번호</label>
                  <input type="text" value={paymentForm.tax_invoice_no}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, tax_invoice_no: e.target.value }))}
                    placeholder="세금계산서 발행번호"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <input type="checkbox" id="tax_inv"
                    checked={paymentForm.is_tax_invoice}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, is_tax_invoice: e.target.checked }))}
                    className="w-4 h-4 rounded" />
                  <label htmlFor="tax_inv" className="text-xs text-gray-600 cursor-pointer">
                    세금계산서 수취 (매입세액공제 가능)
                  </label>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">메모</label>
                  <input type="text" value={paymentForm.memo}
                    onChange={(e) => setPaymentForm((p) => ({ ...p, memo: e.target.value }))}
                    placeholder="메모"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30" />
                </div>
              </div>
              <button type="submit" disabled={isPending}
                className="self-start bg-[#1F3864] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer">
                {isPending ? "저장중…" : "💾 결제 등록"}
              </button>
            </form>
          )}

          {payments.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              등록된 매입 결제 내역이 없습니다
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs">
                    <th className="px-4 py-3 text-left font-semibold">결제일</th>
                    <th className="px-3 py-3 text-left font-semibold">공급업체</th>
                    <th className="px-3 py-3 text-right font-semibold">공급가액</th>
                    <th className="px-3 py-3 text-right font-semibold">부가세</th>
                    <th className="px-3 py-3 text-right font-semibold">결제금액</th>
                    <th className="px-3 py-3 text-left font-semibold">수단</th>
                    <th className="px-3 py-3 text-center font-semibold">세금계산서</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{p.payment_date}</td>
                      <td className="px-3 py-2 text-xs font-medium text-gray-800">{p.supplier ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-right text-gray-500">{(p.supply_amount ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-xs text-right text-orange-500">{(p.vat_amount ?? 0).toLocaleString()}</td>
                      <td className="px-3 py-2 text-sm text-right font-bold text-red-500 whitespace-nowrap">
                        {p.amount.toLocaleString()}원
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">{p.payment_method ?? "-"}</td>
                      <td className="px-3 py-2 text-center text-xs">
                        {p.is_tax_invoice ? (
                          <span className="text-emerald-500 font-semibold">발행</span>
                        ) : (
                          <span className="text-gray-300">미발행</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-200 text-gray-700">
                    <td className="px-4 py-3 text-xs" colSpan={2}>합계 ({payments.length}건)</td>
                    <td className="px-3 py-3 text-xs text-right text-gray-500">
                      {payments.reduce((s, p) => s + (p.supply_amount ?? 0), 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-xs text-right text-orange-500">
                      {payments.reduce((s, p) => s + (p.vat_amount ?? 0), 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-red-600 whitespace-nowrap">
                      {payments.reduce((s, p) => s + p.amount, 0).toLocaleString()}원
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: 미결제 현황 ──────────────────────────────── */}
      {tab === "unpaid" && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-gray-600">
            미결제 매입 현황 ({unpaidPurchases.length}건)
          </div>
          {unpaidPurchases.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              미결제 매입이 없습니다 🎉
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {unpaidPurchases.map((p) => (
                <div key={p.id}
                  className="bg-white rounded-xl border border-orange-200 px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{p.material_name}</span>
                      {p.supplier && (
                        <span className="text-xs text-gray-500">· {p.supplier}</span>
                      )}
                      {p.invoice_no && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                          {p.invoice_no}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">매입일 {p.purchase_date}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-orange-500">
                      {(p.total_cost / 10000).toFixed(1)}만원
                    </div>
                    <button
                      onClick={() => {
                        setTab("payments");
                        setShowPaymentForm(true);
                        setPaymentForm({
                          ...EMPTY_PAYMENT_FORM,
                          purchase_id:   p.id,
                          supplier:      p.supplier ?? "",
                          payment_date:  today,
                          amount:        p.total_cost,
                          supply_amount: Math.round(p.total_cost / 1.1),
                          vat_amount:    p.total_cost - Math.round(p.total_cost / 1.1),
                        });
                      }}
                      className="text-xs text-[#1F3864] hover:underline cursor-pointer mt-0.5"
                    >
                      결제 등록 →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {unpaidPurchases.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm font-semibold text-orange-700">
              미결제 총액: {(unpaidPurchases.reduce((s, p) => s + p.total_cost, 0) / 10000).toLocaleString()}만원
            </div>
          )}
        </div>
      )}

      {/* ── TAB: 부가세 관리 ──────────────────────────────── */}
      {tab === "vat" && (
        <div className="flex flex-col gap-4">
          <div className="text-xs font-bold text-gray-600">부가세 현황 (기간 기준)</div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-400 mb-1">매출 부가세 (징수)</div>
              <div className="text-2xl font-bold text-[#1F3864]">
                {(vatCollected / 10000).toLocaleString()}만원
              </div>
              <div className="text-xs text-gray-400 mt-1">고객에게 받은 부가세</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-400 mb-1">매입 세액공제 (공제)</div>
              <div className="text-2xl font-bold text-emerald-600">
                {(vatDeductible / 10000).toLocaleString()}만원
              </div>
              <div className="text-xs text-gray-400 mt-1">세금계산서 수취분만 공제 가능</div>
            </div>
            <div className={`rounded-xl border p-5 ${vatPayable >= 0 ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="text-xs text-gray-400 mb-1">
                {vatPayable >= 0 ? "납부 예상세액" : "환급 예상세액"}
              </div>
              <div className={`text-2xl font-bold ${vatPayable >= 0 ? "text-orange-600" : "text-emerald-600"}`}>
                {Math.abs(vatPayable / 10000).toLocaleString()}만원
              </div>
              <div className="text-xs text-gray-400 mt-1">매출세 − 매입세</div>
            </div>
          </div>

          {/* 세금계산서 미발행 매입 */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-xs font-bold text-gray-600 mb-3">세금계산서 미수취 결제 (공제 불가)</div>
            {payments.filter((p) => !p.is_tax_invoice).length === 0 ? (
              <div className="text-xs text-gray-400">모든 결제에 세금계산서가 수취되었습니다 ✅</div>
            ) : (
              <div className="flex flex-col gap-2">
                {payments.filter((p) => !p.is_tax_invoice).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm border-b border-gray-50 pb-2">
                    <div>
                      <span className="font-medium text-gray-700">{p.supplier ?? "-"}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.payment_date}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-400">{(p.amount / 10000).toFixed(1)}만원</div>
                      <div className="text-xs text-gray-400">
                        부가세 {((p.vat_amount ?? 0) / 10000).toFixed(1)}만원 공제 불가
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 leading-relaxed">
            💡 <strong>부가세 신고 안내</strong><br />
            • 부가세 신고는 1기(1~6월) → 7월 25일, 2기(7~12월) → 다음해 1월 25일<br />
            • 세금계산서 수취 분만 매입세액 공제 가능합니다<br />
            • 간이과세자는 별도 기준 적용 (세무사 확인 필요)
          </div>
        </div>
      )}
    </div>
  );
}
