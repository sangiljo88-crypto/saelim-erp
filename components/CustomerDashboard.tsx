"use client";

import { useState, useMemo } from "react";
import { saveCustomer } from "@/app/actions/submit";

// ── 타입 ──────────────────────────────────────────────────────
interface DeliveryStats {
  lastDate: string;
  total90: number;
  total30: number;
  count90: number;
}

interface ClaimStats {
  pending: number;
  inProgress: number;
}

interface Customer {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  phone: string | null;
  address: string | null;
  monthly_avg: number;
  payment_terms: number;
  products: string[] | null;
  memo: string | null;
  active: boolean;
  created_at: string;
  delivery: DeliveryStats | null;
  claims: ClaimStats | null;
  health: "good" | "warn" | "risk";
}

interface Props {
  customers: Customer[];
  canEdit: boolean;
}

// ── 상수 ─────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  "식당":       "bg-orange-100 text-orange-700",
  "로드업체":   "bg-blue-100 text-blue-700",
  "택배":       "bg-purple-100 text-purple-700",
  "프랜차이즈": "bg-emerald-100 text-emerald-700",
  "가공업체":   "bg-amber-100 text-amber-700",
  "도소매":     "bg-rose-100 text-rose-700",
};
const CUSTOMER_TYPES = ["식당", "로드업체", "택배", "프랜차이즈", "가공업체", "도소매"];

const HEALTH_META = {
  good: { label: "정상",  bg: "bg-green-100", text: "text-green-700", dot: "bg-green-400",  border: "" },
  warn: { label: "주의",  bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-400",  border: "border-amber-200" },
  risk: { label: "위험",  bg: "bg-red-100",   text: "text-red-600",   dot: "bg-red-400",    border: "border-red-200" },
};

// ── 유틸 ─────────────────────────────────────────────────────
function formatWon(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만`;
  return `${n.toLocaleString()}`;
}

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

function lastDeliveryLabel(delivery: DeliveryStats | null): string {
  if (!delivery) return "납품 기록 없음";
  const d = daysSince(delivery.lastDate);
  if (d === 0) return "오늘";
  if (d === 1) return "어제";
  if (d <= 7)  return `${d}일 전`;
  if (d <= 30) return `${Math.floor(d / 7)}주 전`;
  return `${Math.floor(d / 30)}개월 전`;
}

// ── 거래처 카드 ───────────────────────────────────────────────
function CustomerCard({ c, onSelect }: { c: Customer; onSelect: () => void }) {
  const h = HEALTH_META[c.health];
  const totalOpen = (c.claims?.pending ?? 0) + (c.claims?.inProgress ?? 0);
  const days = c.delivery ? daysSince(c.delivery.lastDate) : 999;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left bg-white rounded-xl border p-4 hover:shadow-md transition-all cursor-pointer
        ${c.health === "risk" ? "border-red-200" : c.health === "warn" ? "border-amber-200" : "border-gray-200"}`}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-sm font-bold text-gray-800 leading-tight">{c.name}</div>
          <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-600"}`}>
            {c.type}
          </span>
        </div>
        <span className={`shrink-0 flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${h.bg} ${h.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${h.dot}`} />
          {h.label}
        </span>
      </div>

      {/* 납품 실적 */}
      <div className="flex items-center gap-3 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-400">최근 납품</div>
          <div className={`text-sm font-semibold ${days > 60 ? "text-red-500" : days > 30 ? "text-amber-600" : "text-gray-700"}`}>
            {lastDeliveryLabel(c.delivery)}
          </div>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <div className="text-xs text-gray-400">90일 납품액</div>
          <div className="text-sm font-semibold text-[#1F3864]">
            {c.delivery ? `${formatWon(c.delivery.total90)}원` : "–"}
          </div>
        </div>
      </div>

      {/* 하단 정보 */}
      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-gray-50">
        <div className="text-xs text-gray-500 truncate">
          {c.contact_name && <span>{c.contact_name}</span>}
          {c.phone && <span className="text-gray-400 ml-1.5">{c.phone}</span>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {totalOpen > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalOpen >= 2 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>
              클레임 {totalOpen}건
            </span>
          )}
          <span className="text-xs text-gray-400">월 {formatWon(c.monthly_avg)}원</span>
        </div>
      </div>
    </button>
  );
}

// ── 상세 패널 ─────────────────────────────────────────────────
function CustomerDetail({ c, onClose }: { c: Customer; onClose: () => void }) {
  const h = HEALTH_META[c.health];
  const totalOpen = (c.claims?.pending ?? 0) + (c.claims?.inProgress ?? 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900">{c.name}</h2>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-600"}`}>
                {c.type}
              </span>
              <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${h.bg} ${h.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${h.dot}`} />
                관계 {h.label}
              </span>
            </div>
            {c.address && <div className="text-xs text-gray-400 mt-1">📍 {c.address}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none shrink-0">✕</button>
        </div>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* 건강도 설명 */}
        {c.health !== "good" && (
          <div className={`rounded-xl p-3 text-xs font-semibold ${c.health === "risk" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>
            {c.health === "risk" && (
              <>🚨 {(c.claims?.pending ?? 0) >= 2 ? `미처리 클레임 ${c.claims?.pending}건 — 즉시 처리가 필요합니다.` : "60일 이상 납품 공백 — 거래 이탈 가능성을 확인하세요."}</>
            )}
            {c.health === "warn" && (
              <>⚠️ {totalOpen > 0 ? `처리 중인 클레임 ${totalOpen}건이 있습니다.` : "30일 이상 납품 공백이 있습니다."}</>
            )}
          </div>
        )}

        {/* 핵심 지표 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-0.5">월 평균 거래액</div>
            <div className="text-base font-bold text-[#1F3864]">{formatWon(c.monthly_avg)}원</div>
            <div className="text-xs text-gray-400">결제 {c.payment_terms}일</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-xs text-gray-400 mb-0.5">90일 납품액</div>
            <div className="text-base font-bold text-gray-700">{c.delivery ? `${formatWon(c.delivery.total90)}원` : "–"}</div>
            <div className="text-xs text-gray-400">{c.delivery ? `${c.delivery.count90}건` : "기록 없음"}</div>
          </div>
          <div className={`rounded-lg p-3 text-center ${totalOpen > 0 ? "bg-red-50" : "bg-gray-50"}`}>
            <div className="text-xs text-gray-400 mb-0.5">미처리 클레임</div>
            <div className={`text-base font-bold ${totalOpen > 0 ? "text-red-500" : "text-green-600"}`}>
              {totalOpen > 0 ? `${totalOpen}건` : "없음"}
            </div>
            {totalOpen > 0 && (
              <div className="text-xs text-gray-400">
                미처리 {c.claims?.pending ?? 0} · 처리중 {c.claims?.inProgress ?? 0}
              </div>
            )}
          </div>
        </div>

        {/* 연락처 */}
        <div className="flex flex-col gap-1.5">
          <div className="text-xs font-semibold text-gray-500">담당자 연락처</div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">{c.contact_name ?? "미등록"}</span>
            {c.phone && (
              <a href={`tel:${c.phone}`} className="text-sm text-[#1F3864] font-semibold hover:underline">
                📞 {c.phone}
              </a>
            )}
          </div>
        </div>

        {/* 주요 품목 */}
        {c.products && c.products.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1.5">주요 거래 품목</div>
            <div className="flex flex-wrap gap-1.5">
              {c.products.map((p) => (
                <span key={p} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* 메모 */}
        {c.memo && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">메모</div>
            <div className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">{c.memo}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────
export default function CustomerDashboard({ customers, canEdit }: Props) {
  const [viewMode,    setViewMode]    = useState<"card" | "list">("card");
  const [filterType,  setFilterType]  = useState("전체");
  const [filterHealth, setFilterHealth] = useState<"전체" | "good" | "warn" | "risk">("전체");
  const [selected,    setSelected]    = useState<Customer | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [formError,   setFormError]   = useState<string | null>(null);
  const [localList,   setLocalList]   = useState<Customer[]>(customers);

  const filtered = useMemo(() => {
    return localList.filter((c) => {
      if (filterType !== "전체" && c.type !== filterType) return false;
      if (filterHealth !== "전체" && c.health !== filterHealth) return false;
      return true;
    });
  }, [localList, filterType, filterHealth]);

  // 요약 수치
  const totalMonthly = localList.reduce((s, c) => s + (c.monthly_avg || 0), 0);
  const riskCount    = localList.filter((c) => c.health === "risk").length;
  const warnCount    = localList.filter((c) => c.health === "warn").length;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const fd = new FormData(e.currentTarget);
      await saveCustomer(fd);
      const newC: Customer = {
        id:            crypto.randomUUID(),
        name:          fd.get("name") as string,
        type:          (fd.get("type") as string) || "식당",
        contact_name:  (fd.get("contact_name") as string) || null,
        phone:         (fd.get("phone") as string) || null,
        address:       (fd.get("address") as string) || null,
        monthly_avg:   Number(fd.get("monthly_avg")) || 0,
        payment_terms: Number(fd.get("payment_terms")) || 30,
        active:        true,
        products:      ((fd.get("products") as string) || "").split(",").map((p) => p.trim()).filter(Boolean),
        memo:          (fd.get("memo") as string) || null,
        created_at:    new Date().toISOString(),
        delivery:      null,
        claims:        null,
        health:        "good",
      };
      setLocalList((prev) => [newC, ...prev]);
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

      {/* ── 요약 헤더 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">전체 거래처</div>
          <div className="text-2xl font-bold text-[#1F3864]">{localList.length}개사</div>
          <div className="text-xs text-gray-400 mt-0.5">활성 거래처</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-400 mb-1">월 평균 거래 합계</div>
          <div className="text-2xl font-bold text-emerald-600">{formatWon(totalMonthly)}원</div>
          <div className="text-xs text-gray-400 mt-0.5">등록 거래처 기준</div>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${riskCount > 0 ? "border-red-200 bg-red-50/30" : "border-gray-200"}`}>
          <div className="text-xs text-gray-400 mb-1">위험 거래처</div>
          <div className={`text-2xl font-bold ${riskCount > 0 ? "text-red-500" : "text-green-600"}`}>
            {riskCount > 0 ? `${riskCount}곳` : "없음"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">클레임·납품 공백</div>
        </div>
        <div className={`bg-white rounded-xl border p-4 ${warnCount > 0 ? "border-amber-200 bg-amber-50/30" : "border-gray-200"}`}>
          <div className="text-xs text-gray-400 mb-1">주의 거래처</div>
          <div className={`text-2xl font-bold ${warnCount > 0 ? "text-amber-600" : "text-green-600"}`}>
            {warnCount > 0 ? `${warnCount}곳` : "없음"}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">처리중 클레임 등</div>
        </div>
      </div>

      {/* ── 도구 바 ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {/* 건강도 필터 */}
          <div className="flex gap-1">
            {(["전체", "risk", "warn", "good"] as const).map((h) => {
              const meta = h === "전체" ? null : HEALTH_META[h];
              return (
                <button key={h} onClick={() => setFilterHealth(h)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors
                    ${filterHealth === h
                      ? (h === "risk" ? "bg-red-500 text-white" : h === "warn" ? "bg-amber-500 text-white" : h === "good" ? "bg-green-500 text-white" : "bg-[#1F3864] text-white")
                      : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                  {h === "전체" ? "전체" : `${meta!.label}`}
                  {h !== "전체" && <span className="ml-1">{localList.filter((c) => c.health === h).length}</span>}
                </button>
              );
            })}
          </div>

          {/* 유형 필터 */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-600 outline-none"
          >
            <option value="전체">유형 전체</option>
            {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {/* 뷰 토글 */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("card")}
              className={`text-xs px-3 py-1.5 transition-colors ${viewMode === "card" ? "bg-[#1F3864] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              ▦ 카드
            </button>
            <button onClick={() => setViewMode("list")}
              className={`text-xs px-3 py-1.5 transition-colors ${viewMode === "list" ? "bg-[#1F3864] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}>
              ≡ 목록
            </button>
          </div>

          {canEdit && (
            <button onClick={() => { setShowForm((v) => !v); setFormError(null); }}
              className="text-xs bg-[#1F3864] text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-[#1a2f58] transition-colors">
              + 거래처 추가
            </button>
          )}
        </div>
      </div>

      {/* ── 추가 폼 ── */}
      {showForm && canEdit && (
        <form onSubmit={handleSave} className="bg-white rounded-xl border border-[#1F3864]/20 p-5 flex flex-col gap-3">
          <div className="text-sm font-bold text-gray-800">새 거래처 등록</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">거래처명 <span className="text-red-500">*</span></label>
              <input name="name" required placeholder="예: BHC본사"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">유형</label>
              <select name="type" className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none bg-white focus:border-[#1F3864]">
                {CUSTOMER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">담당자명</label>
              <input name="contact_name" placeholder="예: 김철수"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">연락처</label>
              <input name="phone" placeholder="예: 02-1234-5678"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">월평균 거래액 (원)</label>
              <input name="monthly_avg" type="number" placeholder="예: 30000000"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">결제 조건 (일)</label>
              <input name="payment_terms" type="number" defaultValue={30}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">주요 거래 품목 (쉼표 구분)</label>
            <input name="products" placeholder="예: 돼지 머리, 돼지 내장, 돼지 뼈"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">주소</label>
            <input name="address" placeholder="예: 서울시 강남구 테헤란로 101"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#1F3864]" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">메모</label>
            <textarea name="memo" rows={2} placeholder="특이사항, 계약조건 등"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none resize-none focus:border-[#1F3864]" />
          </div>
          {formError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-[#1F3864] text-white font-semibold rounded-lg text-sm hover:bg-[#1a2f58] disabled:opacity-50 transition-colors">
              {saving ? "저장 중..." : "등록"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              취소
            </button>
          </div>
        </form>
      )}

      {/* ── 선택된 거래처 상세 ── */}
      {selected && (
        <CustomerDetail c={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── 카드 뷰 ── */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-sm text-gray-400">
              해당 조건의 거래처가 없습니다
            </div>
          ) : (
            filtered.map((c) => (
              <CustomerCard
                key={c.id}
                c={c}
                onSelect={() => setSelected(selected?.id === c.id ? null : c)}
              />
            ))
          )}
        </div>
      )}

      {/* ── 리스트 뷰 ── */}
      {viewMode === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-gray-400">해당 조건의 거래처가 없습니다</div>
          ) : (
            <>
              <div className="hidden sm:grid text-[10px] text-gray-400 font-semibold px-4 py-2.5 bg-gray-50 border-b border-gray-100"
                style={{ gridTemplateColumns: "auto 1fr 80px 100px 100px 120px" }}>
                <span className="w-12">상태</span>
                <span>거래처명 / 품목</span>
                <span className="text-center">유형</span>
                <span className="text-right">월 평균</span>
                <span className="text-right">90일 납품</span>
                <span className="text-right">담당자</span>
              </div>
              {filtered.map((c) => {
                const h = HEALTH_META[c.health];
                const totalOpen = (c.claims?.pending ?? 0) + (c.claims?.inProgress ?? 0);
                return (
                  <button key={c.id} onClick={() => setSelected(selected?.id === c.id ? null : c)}
                    className="w-full text-left hidden sm:grid items-center px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors gap-2"
                    style={{ gridTemplateColumns: "auto 1fr 80px 100px 100px 120px" }}>
                    <div className="w-12 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${h.dot}`} />
                      {totalOpen > 0 && (
                        <span className="text-[10px] font-bold text-red-500">{totalOpen}</span>
                      )}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-800">{c.name}</div>
                      {c.products && c.products.length > 0 && (
                        <div className="text-xs text-gray-400 truncate">
                          {c.products.slice(0, 2).join(" · ")}{c.products.length > 2 ? ` 외 ${c.products.length - 2}` : ""}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[c.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {c.type}
                      </span>
                    </div>
                    <div className="text-right text-sm font-bold text-[#1F3864]">
                      {c.monthly_avg > 0 ? `${formatWon(c.monthly_avg)}원` : "–"}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-700">
                        {c.delivery ? `${formatWon(c.delivery.total90)}원` : "–"}
                      </div>
                      <div className="text-xs text-gray-400">{lastDeliveryLabel(c.delivery)}</div>
                    </div>
                    <div className="text-right text-xs text-gray-600">
                      <div>{c.contact_name ?? "–"}</div>
                      <div className="text-gray-400">{c.phone ?? ""}</div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
