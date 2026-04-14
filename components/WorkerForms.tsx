"use client";

import { useState, useRef, useEffect } from "react";
import { submitProductionLog, submitHygieneCheck, submitClaim } from "@/app/actions/submit";
import DeliveryForm from "@/components/DeliveryForm";

interface Props {
  dept: string;
  todayProduction?: boolean;
  todayHygiene?: boolean;
}

const PRODUCT_CATALOG = [
  { id: "p01", name: "돼지 머리",   category: "부산물", unit: "두" },
  { id: "p02", name: "돼지 뒷고기", category: "부산물", unit: "kg" },
  { id: "p03", name: "돼지 족발",   category: "부산물", unit: "kg" },
  { id: "p04", name: "돼지 내장",   category: "부산물", unit: "kg" },
  { id: "p05", name: "돼지 뼈",     category: "부산물", unit: "kg" },
  { id: "p06", name: "돼지 껍데기", category: "부산물", unit: "kg" },
  { id: "p07", name: "육수 (포장)", category: "가공품", unit: "포" },
  { id: "p08", name: "국물 베이스", category: "가공품", unit: "kg" },
  { id: "p09", name: "순대 원료",   category: "가공품", unit: "kg" },
  { id: "p10", name: "혼합 부산물", category: "부산물", unit: "kg" },
];

const HYGIENE_ITEMS = [
  "해동육 일지 작성 완료",
  "냉장 온도 0~5°C 확인",
  "냉동 온도 -18°C 이하 확인",
  "원료·완제품 이격 15cm 이상",
  "포장재 별도 보관 확인",
  "부적합품 별도 구역 보관",
  "폐기물 밀폐 보관",
  "작업자 위생복·위생모 착용",
  "손 세척 설비 정상 가동",
  "성애 제거 완료",
];

const CATEGORIES = ["전체", "부산물", "가공품"];

// 부서별 사용 가능한 폼 탭
const DEPT_TABS: Record<string, Array<"production" | "hygiene" | "claim" | "delivery">> = {
  "생산팀":   ["production", "hygiene"],
  "가공팀":   ["production", "hygiene"],
  "스킨팀":   ["production", "hygiene"],
  "재고팀":   ["hygiene"],
  "품질팀":   ["hygiene", "claim"],
  "CS팀":     ["claim"],
  "배송팀":   ["delivery", "hygiene"],
  "마케팅팀": ["claim"],
  "회계팀":   ["hygiene"],
  "개발팀":   ["hygiene"],
  "온라인팀": ["claim"],
};

const TAB_LABELS: Record<"production" | "hygiene" | "claim" | "delivery", string> = {
  production: "📋 생산일지",
  hygiene:    "🧹 위생점검",
  claim:      "⚠️ 클레임",
  delivery:   "🚚 납품전표",
};

export default function WorkerForms({ dept, todayProduction = false, todayHygiene = false }: Props) {
  const tabs = DEPT_TABS[dept] ?? ["hygiene", "claim"];
  const [activeForm, setActiveForm] = useState<"production" | "hygiene" | "claim" | "delivery">(tabs[0]);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSuccess = (type: string) => { setSubmitted(type); setError(null); };
  const handleError = (msg: string) => setError(msg);

  if (submitted) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
        <div className="text-4xl mb-3">✅</div>
        <div className="text-lg font-bold text-emerald-700">제출 완료!</div>
        <div className="text-sm text-emerald-600 mt-1">팀장에게 전달되었습니다.</div>
        <button onClick={() => setSubmitted(null)} className="mt-4 text-sm text-emerald-700 underline">
          추가 입력하기
        </button>
      </div>
    );
  }

  // 탭별 기제출 여부
  const submittedMap: Partial<Record<"production" | "hygiene" | "claim" | "delivery", boolean>> = {
    production: todayProduction,
    hygiene:    todayHygiene,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 부서 안내 */}
      <div className="text-sm sm:text-xs text-gray-400 text-center">
        <span className="font-medium text-gray-600">{dept}</span> 입력 가능 항목
      </div>

      {/* 배송팀: 배차일지 바로가기 */}
      {dept === "배송팀" && (
        <a
          href="/dispatch"
          className="flex items-center justify-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 text-sm font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
        >
          🚚 배차일지 작성하기
        </a>
      )}

      {/* 탭 — 부서별 필터 (모바일 터치 최적화) */}
      <div
        className="bg-white rounded-xl p-1.5 border border-gray-200"
        style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: "6px" }}
      >
        {tabs.map((f) => (
          <button key={f} onClick={() => { setActiveForm(f); setError(null); }}
            className={`py-3 sm:py-2.5 rounded-lg text-sm sm:text-xs font-semibold transition-colors relative min-h-[48px] sm:min-h-0 ${
              activeForm === f ? "bg-[#1F3864] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {TAB_LABELS[f]}
            {submittedMap[f] && (
              <span className={`ml-1 text-[10px] font-bold ${activeForm === f ? "text-emerald-300" : "text-emerald-500"}`}>
                ✅
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-base sm:text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {activeForm === "production" && (
        <ProductionForm
          onSuccess={() => handleSuccess("생산일지")}
          onError={handleError}
          todaySubmitted={todayProduction}
        />
      )}
      {activeForm === "hygiene" && (
        <HygieneForm
          onSuccess={() => handleSuccess("위생점검")}
          onError={handleError}
          todaySubmitted={todayHygiene}
        />
      )}
      {activeForm === "claim" && (
        <ClaimForm onSuccess={() => handleSuccess("클레임")} onError={handleError} />
      )}
      {activeForm === "delivery" && (
        <DeliveryForm
          customers={[]}
          onSuccess={() => handleSuccess("납품전표")}
          onError={handleError}
        />
      )}
    </div>
  );
}

/* ─── +/- 스테퍼 숫자 입력 컴포넌트 ─── */
function StepperInput({
  name,
  value,
  onChange,
  placeholder,
  step = 1,
}: {
  name: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  step?: number;
}) {
  const adjust = (delta: number) => {
    const current = parseFloat(value) || 0;
    const next = Math.max(0, current + delta);
    onChange(String(next));
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => adjust(-step)}
        className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-lg font-bold active:bg-gray-200 transition-colors shrink-0"
        aria-label="감소"
      >
        −
      </button>
      <input
        type="number"
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 rounded-xl border border-gray-300 px-3 py-3 sm:py-2 text-base sm:text-sm text-center focus:border-[#1F3864] outline-none min-h-[48px] sm:min-h-0"
      />
      <button
        type="button"
        onClick={() => adjust(step)}
        className="w-10 h-10 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-gray-300 bg-gray-50 text-gray-600 text-lg font-bold active:bg-gray-200 transition-colors shrink-0"
        aria-label="증가"
      >
        +
      </button>
    </div>
  );
}

/* ─── 생산일지 ─── */
function ProductionForm({
  onSuccess, onError, todaySubmitted = false,
}: {
  onSuccess: () => void;
  onError: (m: string) => void;
  todaySubmitted?: boolean;
}) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [category, setCategory] = useState("전체");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [inputQty, setInputQty] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [packQty, setPackQty] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // ── 최근 사용 제품 (localStorage) ──
  const RECENT_KEY = "saelim_recent_products";
  const [recentProducts, setRecentProducts] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) setRecentProducts(JSON.parse(stored));
    } catch { /* SSR / parse 오류 무시 */ }
  }, []);

  function saveRecentProduct(code: string, name: string) {
    setRecentProducts((prev) => {
      const deduped = prev.filter((p) => p.code !== code);
      const next = [{ code, name }, ...deduped].slice(0, 5);
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* 무시 */ }
      return next;
    });
  }

  const filtered = category === "전체" ? PRODUCT_CATALOG : PRODUCT_CATALOG.filter((p) => p.category === category);
  const activeProduct = PRODUCT_CATALOG.find((p) => p.id === selectedProduct);
  const unit = customMode ? "kg" : (activeProduct?.unit ?? "kg");
  const canSubmit = customMode ? !!customName : !!selectedProduct;

  // ── 실시간 수율 계산
  const inputNum  = parseFloat(inputQty)  || 0;
  const outputNum = parseFloat(outputQty) || 0;
  const yieldRate = inputNum > 0 && outputNum > 0
    ? Math.round((outputNum / inputNum) * 1000) / 10
    : null;
  const yieldStyle =
    yieldRate === null ? null
    : yieldRate >= 92  ? { bg: "bg-emerald-50 border-emerald-300", text: "text-emerald-700", msg: `✅ 목표(92%) 달성` }
    : yieldRate >= 88  ? { bg: "bg-amber-50 border-amber-300",     text: "text-amber-700",   msg: `⚠️ 목표 미달` }
    :                    { bg: "bg-red-50 border-red-300",          text: "text-red-600",     msg: `🚨 기준(88%) 미달 — 이슈 확인 필요` };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      const productCode = customMode ? "custom"   : selectedProduct!;
      const productName = customMode ? customName : activeProduct!.name;
      fd.set("product_id",   productCode);
      fd.set("product_name", productName);
      await submitProductionLog(fd);
      saveRecentProduct(productCode, productName);
      onSuccess();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-4 flex flex-col gap-5">
      <h2 className="font-bold text-gray-800 text-base sm:text-sm">생산일지 입력</h2>

      {/* 오늘 이미 제출 배너 */}
      {todaySubmitted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-base sm:text-sm text-emerald-700 flex items-center gap-2 w-full">
          <span className="text-xl">✅</span>
          <span>오늘 생산일지를 이미 제출했습니다. <span className="font-normal text-emerald-600">(추가 입력도 가능합니다)</span></span>
        </div>
      )}

      <Field label="작업 날짜" type="date" name="date" defaultValue={new Date().toISOString().split("T")[0]} />

      {/* 제품 선택 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm sm:text-xs font-medium text-gray-700">제품 선택 <span className="text-red-500">*</span></label>
          <button type="button"
            onClick={() => { setCustomMode(!customMode); setSelectedProduct(null); setCustomName(""); }}
            className={`text-sm sm:text-xs px-3 py-1.5 sm:py-1 rounded-full border transition-colors min-h-[40px] sm:min-h-0 ${
              customMode ? "bg-[#1F3864] text-white border-[#1F3864]" : "text-gray-500 border-gray-300"
            }`}>
            {customMode ? "✕ 직접입력 취소" : "✏️ 직접 입력"}
          </button>
        </div>

        {/* 최근 사용 제품 */}
        {!customMode && recentProducts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-400">최근 사용</span>
            <div className="flex flex-wrap gap-1.5">
              {recentProducts.map((rp) => (
                <button
                  key={rp.code}
                  type="button"
                  onClick={() => {
                    if (rp.code === "custom") {
                      setCustomMode(true);
                      setCustomName(rp.name);
                      setSelectedProduct(null);
                    } else {
                      setCustomMode(false);
                      setCustomName("");
                      setSelectedProduct(rp.code);
                    }
                  }}
                  className={`bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-full text-xs cursor-pointer hover:bg-blue-100 transition-colors ${
                    selectedProduct === rp.code ? "ring-2 ring-blue-400" : ""
                  }`}
                >
                  {rp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {customMode ? (
          <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
            placeholder="제품명을 직접 입력하세요" autoFocus
            className="rounded-xl border border-[#1F3864] px-4 py-3 sm:py-2 text-base sm:text-sm outline-none ring-2 ring-[#1F3864]/20 min-h-[48px] sm:min-h-0" />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`text-sm sm:text-xs px-3 py-2 sm:py-1.5 rounded-full font-medium transition-colors min-h-[40px] sm:min-h-0 ${
                    category === cat ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
                  }`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((product) => (
                <button key={product.id} type="button" onClick={() => setSelectedProduct(product.id)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-95 min-h-[48px] ${
                    selectedProduct === product.id
                      ? "border-[#1F3864] bg-[#1F3864]/5"
                      : "border-gray-200 bg-gray-50 hover:border-gray-300"
                  }`}>
                  <span className={`text-sm font-semibold ${selectedProduct === product.id ? "text-[#1F3864]" : "text-gray-800"}`}>
                    {selectedProduct === product.id && "✓ "}{product.name}
                  </span>
                  <span className="text-xs text-gray-400">{product.category} · {product.unit}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {canSubmit && (
          <div className="flex items-center gap-2 bg-[#1F3864]/5 border border-[#1F3864]/20 rounded-xl px-4 py-2.5">
            <span className="text-base">📦</span>
            <span className="text-sm font-semibold text-[#1F3864]">
              {customMode ? customName : activeProduct?.name}
            </span>
            <span className="text-xs text-gray-400 ml-auto">선택됨</span>
          </div>
        )}
      </div>

      {/* 수량 — 투입/산출은 controlled (수율 계산용), 스테퍼 버튼 포함 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm sm:text-xs font-medium text-gray-700">원료 투입량 ({unit})</label>
          <StepperInput
            name="input_qty"
            value={inputQty}
            onChange={setInputQty}
            placeholder="예: 1500"
            step={10}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm sm:text-xs font-medium text-gray-700">완성품 생산량 ({unit})</label>
          <StepperInput
            name="output_qty"
            value={outputQty}
            onChange={setOutputQty}
            placeholder="예: 1380"
            step={10}
          />
        </div>
      </div>

      {/* 실시간 수율 표시 — 모바일에서 크게 */}
      {yieldStyle && yieldRate !== null && (
        <div className={`flex flex-col sm:flex-row items-center justify-between border rounded-xl px-4 py-4 sm:py-3 gap-1 ${yieldStyle.bg}`}>
          <span className={`text-2xl sm:text-sm font-bold ${yieldStyle.text}`}>
            현재 수율: {yieldRate}%
          </span>
          <span className={`text-sm sm:text-xs font-semibold ${yieldStyle.text}`}>{yieldStyle.msg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm sm:text-xs font-medium text-gray-700">폐기량 ({unit})</label>
          <StepperInput
            name="waste_qty"
            value={wasteQty}
            onChange={setWasteQty}
            placeholder="예: 30"
            step={1}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm sm:text-xs font-medium text-gray-700">포장재 사용량 (개)</label>
          <StepperInput
            name="pack_qty"
            value={packQty}
            onChange={setPackQty}
            placeholder="예: 200"
            step={10}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm sm:text-xs font-medium text-gray-700">이슈 사항 (없으면 비워두세요)</label>
        <textarea name="issue_note" rows={3} placeholder="설비 이상, 원료 부족, 기타 특이사항..."
          className="rounded-xl border border-gray-300 px-4 py-3 sm:py-2 text-base sm:text-sm focus:border-[#1F3864] outline-none resize-none min-h-[48px]" />
      </div>

      {/* 제출 버튼 — 모바일에서 하단 고정 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-5 -mb-5 sm:relative sm:border-t-0 sm:p-0 sm:mx-0 sm:mb-0">
        <button type="submit" disabled={!canSubmit || loading}
          className="w-full h-14 sm:h-auto sm:py-3.5 bg-[#1F3864] text-white font-bold sm:font-semibold rounded-xl text-base sm:text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {loading ? "⏳ 저장 중..." : canSubmit ? "생산일지 제출" : "제품을 먼저 선택해주세요"}
        </button>
      </div>
    </form>
  );
}

/* ─── 위생점검 ─── */
function HygieneForm({
  onSuccess, onError, todaySubmitted = false,
}: {
  onSuccess: () => void;
  onError: (m: string) => void;
  todaySubmitted?: boolean;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(HYGIENE_ITEMS.map((item) => [item, false]))
  );
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  async function handleSubmit() {
    setLoading(true);
    try {
      await submitHygieneCheck(checked, today);
      onSuccess();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const passedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800 text-base sm:text-sm">위생 점검 체크리스트</h2>
        <span className="text-sm sm:text-xs font-semibold text-gray-500">{passedCount}/{HYGIENE_ITEMS.length}</span>
      </div>

      {/* 오늘 이미 제출 배너 */}
      {todaySubmitted && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-base sm:text-sm text-emerald-700 flex items-center gap-2 w-full">
          <span className="text-xl">✅</span>
          <span>오늘 위생점검을 이미 제출했습니다. <span className="font-normal text-emerald-600">(추가 입력도 가능합니다)</span></span>
        </div>
      )}

      {HYGIENE_ITEMS.map((item) => (
        <button key={item} type="button" onClick={() => setChecked((p) => ({ ...p, [item]: !p[item] }))}
          className={`flex items-center gap-3 p-4 sm:p-3.5 rounded-xl border text-left transition-all min-h-[48px] ${
            checked[item] ? "bg-emerald-50 border-emerald-300" : "bg-gray-50 border-gray-200"
          }`}>
          <span className={`w-7 h-7 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            checked[item] ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
          }`}>
            {checked[item] && <span className="text-white text-xs font-bold">✓</span>}
          </span>
          <span className={`text-base sm:text-sm ${checked[item] ? "text-emerald-700 font-medium" : "text-gray-700"}`}>{item}</span>
        </button>
      ))}

      {/* 제출 버튼 — 모바일에서 하단 고정 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-5 -mb-5 sm:relative sm:border-t-0 sm:p-0 sm:mx-0 sm:mb-0">
        <button onClick={handleSubmit} disabled={loading}
          className="w-full h-14 sm:h-auto sm:py-3.5 bg-[#1F3864] text-white font-bold sm:font-semibold rounded-xl text-base sm:text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-60 transition-all">
          {loading ? "⏳ 저장 중..." : `점검 완료 제출 (${passedCount}/${HYGIENE_ITEMS.length} 통과)`}
        </button>
      </div>
    </div>
  );
}

/* ─── 클레임 ─── */
function ClaimForm({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function toggleProduct(name: string) {
    setSelectedProducts((p) => p.includes(name) ? p.filter((n) => n !== name) : [...p, name]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      await submitClaim(fd, selectedProducts);
      onSuccess();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-4 flex flex-col gap-5 sm:gap-4">
      <h2 className="font-bold text-gray-800 text-base sm:text-sm">클레임 접수</h2>

      <Field label="접수 날짜" type="date" name="claim_date" defaultValue={new Date().toISOString().split("T")[0]} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm sm:text-xs font-medium text-gray-700">거래처명 <span className="text-red-500">*</span></label>
        <input name="client_name" type="text" required placeholder="예: BHC 본사"
          className="rounded-xl border border-gray-300 px-4 py-3 sm:py-2 text-base sm:text-sm focus:border-[#1F3864] outline-none min-h-[48px] sm:min-h-0" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm sm:text-xs font-medium text-gray-700">관련 제품 (복수 선택 가능)</label>
        <div className="grid grid-cols-2 gap-2">
          {PRODUCT_CATALOG.slice(0, 8).map((p) => (
            <button key={p.id} type="button" onClick={() => toggleProduct(p.name)}
              className={`text-sm sm:text-xs px-3 py-3 sm:py-2.5 rounded-xl border font-medium transition-all min-h-[48px] sm:min-h-0 ${
                selectedProducts.includes(p.name)
                  ? "bg-red-50 border-red-400 text-red-700"
                  : "bg-gray-50 border-gray-200 text-gray-600"
              }`}>
              {selectedProducts.includes(p.name) ? "✓ " : ""}{p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm sm:text-xs font-medium text-gray-700">클레임 유형</label>
        <select name="claim_type" className="rounded-xl border border-gray-300 px-4 py-3 sm:py-2 text-base sm:text-sm focus:border-[#1F3864] outline-none bg-white min-h-[48px] sm:min-h-0">
          <option>품질 이상</option>
          <option>배송 지연</option>
          <option>수량 부족</option>
          <option>포장 불량</option>
          <option>기타</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm sm:text-xs font-medium text-gray-700">내용 <span className="text-red-500">*</span></label>
        <textarea name="content" required rows={4} placeholder="클레임 내용을 구체적으로 입력하세요..."
          className="rounded-xl border border-gray-300 px-4 py-3 sm:py-2 text-base sm:text-sm focus:border-[#1F3864] outline-none resize-none" />
      </div>

      {/* 제출 버튼 — 모바일에서 하단 고정 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-5 -mb-5 sm:relative sm:border-t-0 sm:p-0 sm:mx-0 sm:mb-0">
        <button type="submit" disabled={loading}
          className="w-full h-14 sm:h-auto sm:py-3.5 bg-red-600 text-white font-bold sm:font-semibold rounded-xl text-base sm:text-sm hover:bg-red-700 active:scale-95 disabled:opacity-60 transition-all">
          {loading ? "⏳ 접수 중..." : "클레임 접수"}
        </button>
      </div>
    </form>
  );
}

/* ─── 공용 ─── */
function Field({ label, type, name, placeholder, defaultValue }: {
  label: string; type: string; name: string; placeholder?: string; defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm sm:text-xs font-medium text-gray-700">{label}</label>
      <input type={type} name={name} placeholder={placeholder} defaultValue={defaultValue}
        className="rounded-xl border border-gray-300 px-4 py-3 sm:py-2 text-base sm:text-sm focus:border-[#1F3864] outline-none min-h-[48px] sm:min-h-0" />
    </div>
  );
}
