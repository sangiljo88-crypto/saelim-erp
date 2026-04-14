"use client";

import { useState } from "react";
import { saveCustomer } from "@/app/actions/sales";

interface Customer {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  phone: string | null;
  monthly_avg: number;
  payment_terms: number;
  active: boolean;
  products: string[] | null;
  memo: string | null;
}

interface Props {
  initialCustomers: Customer[];
}

const TYPE_COLORS: Record<string, string> = {
  "식당":       "bg-orange-100 text-orange-700",
  "로드업체":   "bg-blue-100 text-blue-700",
  "택배":       "bg-purple-100 text-purple-700",
  "프랜차이즈": "bg-emerald-100 text-emerald-700",
  "가공업체":   "bg-amber-100 text-amber-700",
  "도소매":     "bg-rose-100 text-rose-700",
};

const CUSTOMER_TYPES = ["식당", "로드업체", "택배", "프랜차이즈", "가공업체", "도소매"];

export default function CustomerListView({ initialCustomers }: Props) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("전체");

  const filtered = filterType === "전체"
    ? customers
    : customers.filter((c) => c.type === filterType);

  const totalMonthly = customers.reduce((s, c) => s + (c.monthly_avg ?? 0), 0);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const fd = new FormData(e.currentTarget);
      await saveCustomer(fd);
      // 임시로 낙관적 업데이트 (새로고침 없이 목록에 추가)
      const newCustomer: Customer = {
        id:            crypto.randomUUID(),
        name:          fd.get("name") as string,
        type:          (fd.get("type") as string) || "식당",
        contact_name:  (fd.get("contact_name") as string) || null,
        phone:         (fd.get("phone") as string) || null,
        monthly_avg:   Number(fd.get("monthly_avg")) || 0,
        payment_terms: Number(fd.get("payment_terms")) || 30,
        active:        true,
        products:      ((fd.get("products") as string) || "").split(",").map((p) => p.trim()).filter(Boolean),
        memo:          (fd.get("memo") as string) || null,
      };
      setCustomers((prev) => [newCustomer, ...prev]);
      setShowForm(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 요약 헤더 */}
      <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">거래처 수</div>
          <div className="text-2xl font-bold text-[#1F3864]">{customers.length}개사</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">월평균 거래 합계</div>
          <div className="text-lg font-bold text-emerald-600">
            {(totalMonthly / 10_000).toLocaleString()}만원
          </div>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setFormError(null); }}
          className="text-sm bg-[#1F3864] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#162c52] active:scale-95 transition-all"
        >
          {showForm ? "취소" : "+ 거래처 추가"}
        </button>
      </div>

      {/* 인라인 추가 폼 */}
      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-[#1F3864]/30 p-5 flex flex-col gap-4">
          <div className="text-sm font-bold text-gray-800">새 거래처 등록</div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">거래처명 <span className="text-red-500">*</span></label>
              <input name="name" required type="text" placeholder="예: BHC본사"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">유형</label>
              <select name="type" className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none bg-white">
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">담당자명</label>
              <input name="contact_name" type="text" placeholder="예: 김철수"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">연락처</label>
              <input name="phone" type="text" placeholder="예: 02-1234-5678"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">월평균 거래액 (원)</label>
              <input name="monthly_avg" type="number" placeholder="예: 30000000"
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-600">결제 조건 (일)</label>
              <input name="payment_terms" type="number" defaultValue={30}
                className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">주요 거래 품목 (쉼표 구분)</label>
            <input name="products" type="text" placeholder="예: 돼지 머리, 돼지 내장, 돼지 뼈"
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">주소</label>
            <input name="address" type="text" placeholder="예: 서울시 강남구 테헤란로 101"
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">메모</label>
            <textarea name="memo" rows={2} placeholder="특이사항, 계약조건 등"
              className="rounded-xl border border-gray-300 px-3 py-2.5 text-sm focus:border-[#1F3864] outline-none resize-none" />
          </div>

          {formError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {formError}
            </div>
          )}

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] disabled:opacity-50 active:scale-95 transition-all">
            {saving ? "저장 중..." : "거래처 등록"}
          </button>
        </form>
      )}

      {/* 유형 필터 */}
      <div className="flex gap-1.5 flex-wrap">
        {["전체", ...CUSTOMER_TYPES].map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              filterType === t ? "bg-[#1F3864] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            }`}>
            {t}
          </button>
        ))}
      </div>

      {/* 거래처 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-sm text-gray-400">
            거래처 데이터가 없습니다
          </div>
        ) : (
          <>
            <div className="grid text-[10px] text-gray-400 font-semibold px-4 py-2.5 bg-gray-50 border-b border-gray-100"
              style={{ gridTemplateColumns: "1fr auto 1fr 1fr" }}>
              <span>거래처명</span>
              <span className="text-center px-4">유형</span>
              <span className="text-right">월평균 거래액</span>
              <span className="text-right">담당자 / 연락처</span>
            </div>
            {filtered.map((c) => (
              <div key={c.id} className="grid items-center px-4 py-3.5 border-b border-gray-100 last:border-0 gap-2"
                style={{ gridTemplateColumns: "1fr auto 1fr 1fr" }}>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{c.name}</div>
                  {c.products && c.products.length > 0 && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">
                      {c.products.slice(0, 2).join(" · ")}{c.products.length > 2 ? ` 외 ${c.products.length - 2}` : ""}
                    </div>
                  )}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-600"}`}>
                  {c.type}
                </span>
                <div className="text-right">
                  <div className="text-sm font-bold text-[#1F3864]">
                    {c.monthly_avg > 0 ? `${(c.monthly_avg / 10_000).toLocaleString()}만원` : "-"}
                  </div>
                  <div className="text-xs text-gray-400">결제 {c.payment_terms}일</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-700">{c.contact_name ?? "-"}</div>
                  <div className="text-xs text-gray-400">{c.phone ?? "-"}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
