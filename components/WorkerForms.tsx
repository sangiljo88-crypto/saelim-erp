"use client";

import { useState, useRef } from "react";
import { submitProductionLog, submitHygieneCheck, submitClaim } from "@/app/actions/submit";
import DeliveryForm from "@/components/DeliveryForm";

interface Props { dept: string }

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

export default function WorkerForms({ dept }: Props) {
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

  return (
    <div className="flex flex-col gap-4">
      {/* 부서 안내 */}
      <div className="text-xs text-gray-400 text-center">
        <span className="font-medium text-gray-600">{dept}</span> 입력 가능 항목
      </div>

      {/* 탭 — 부서별 필터 */}
      <div
        className="bg-white rounded-xl p-1.5 border border-gray-200"
        style={{ display: "grid", gridTemplateColumns: `repeat(${tabs.length}, 1fr)`, gap: "6px" }}
      >
        {tabs.map((f) => (
          <button key={f} onClick={() => { setActiveForm(f); setError(null); }}
            className={`py-2.5 rounded-lg text-xs font-semibold transition-colors ${
              activeForm === f ? "bg-[#1F3864] text-white shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            {TAB_LABELS[f]}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {activeForm === "production" && (
        <ProductionForm onSuccess={() => handleSuccess("생산일지")} onError={handleError} />
      )}
      {activeForm === "hygiene" && (
        <HygieneForm onSuccess={() => handleSuccess("위생점검")} onError={handleError} />
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

/* ─── 생산일지 ─── */
function ProductionForm({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [category, setCategory] = useState("전체");
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const filtered = category === "전체" ? PRODUCT_CATALOG : PRODUCT_CATALOG.filter((p) => p.category === category);
  const activeProduct = PRODUCT_CATALOG.find((p) => p.id === selectedProduct);
  const unit = customMode ? "kg" : (activeProduct?.unit ?? "kg");
  const canSubmit = customMode ? !!customName : !!selectedProduct;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      fd.set("product_id",   customMode ? "custom"             : selectedProduct!);
      fd.set("product_name", customMode ? customName           : activeProduct!.name);
      await submitProductionLog(fd);
      onSuccess();
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-5">
      <h2 className="font-bold text-gray-800">생산일지 입력</h2>

      <Field label="작업 날짜" type="date" name="date" defaultValue={new Date().toISOString().split("T")[0]} />

      {/* 제품 선택 */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">제품 선택 <span className="text-red-500">*</span></label>
          <button type="button"
            onClick={() => { setCustomMode(!customMode); setSelectedProduct(null); setCustomName(""); }}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              customMode ? "bg-[#1F3864] text-white border-[#1F3864]" : "text-gray-500 border-gray-300"
            }`}>
            {customMode ? "✕ 직접입력 취소" : "✏️ 직접 입력"}
          </button>
        </div>

        {customMode ? (
          <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
            placeholder="제품명을 직접 입력하세요" autoFocus
            className="rounded-xl border border-[#1F3864] px-4 py-3 text-sm outline-none ring-2 ring-[#1F3864]/20" />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                    category === cat ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600"
                  }`}>{cat}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {filtered.map((product) => (
                <button key={product.id} type="button" onClick={() => setSelectedProduct(product.id)}
                  className={`flex flex-col items-start gap-0.5 px-4 py-3 rounded-xl border-2 text-left transition-all active:scale-95 ${
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

      {/* 수량 */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={`원료 투입량 (${unit})`} type="number" name="input_qty"  placeholder="예: 1500" />
        <Field label={`완성품 생산량 (${unit})`} type="number" name="output_qty" placeholder="예: 1380" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`폐기량 (${unit})`}       type="number" name="waste_qty"  placeholder="예: 30" />
        <Field label="포장재 사용량 (개)"        type="number" name="pack_qty"   placeholder="예: 200" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">이슈 사항 (없으면 비워두세요)</label>
        <textarea name="issue_note" rows={3} placeholder="설비 이상, 원료 부족, 기타 특이사항..."
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none resize-none" />
      </div>

      <button type="submit" disabled={!canSubmit || loading}
        className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
        {loading ? "저장 중..." : canSubmit ? "생산일지 제출" : "제품을 먼저 선택해주세요"}
      </button>
    </form>
  );
}

/* ─── 위생점검 ─── */
function HygieneForm({ onSuccess, onError }: { onSuccess: () => void; onError: (m: string) => void }) {
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
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-gray-800">위생 점검 체크리스트</h2>
        <span className="text-xs font-semibold text-gray-500">{passedCount}/{HYGIENE_ITEMS.length}</span>
      </div>

      {HYGIENE_ITEMS.map((item) => (
        <button key={item} type="button" onClick={() => setChecked((p) => ({ ...p, [item]: !p[item] }))}
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
            checked[item] ? "bg-emerald-50 border-emerald-300" : "bg-gray-50 border-gray-200"
          }`}>
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            checked[item] ? "bg-emerald-500 border-emerald-500" : "border-gray-300"
          }`}>
            {checked[item] && <span className="text-white text-xs font-bold">✓</span>}
          </span>
          <span className={`text-sm ${checked[item] ? "text-emerald-700 font-medium" : "text-gray-700"}`}>{item}</span>
        </button>
      ))}

      <button onClick={handleSubmit} disabled={loading}
        className="w-full py-3.5 bg-[#1F3864] text-white font-semibold rounded-xl text-sm hover:bg-[#162c52] active:scale-95 disabled:opacity-60 transition-all">
        {loading ? "저장 중..." : `점검 완료 제출 (${passedCount}/${HYGIENE_ITEMS.length} 통과)`}
      </button>
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
    <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4">
      <h2 className="font-bold text-gray-800">클레임 접수</h2>

      <Field label="접수 날짜" type="date" name="claim_date" defaultValue={new Date().toISOString().split("T")[0]} />

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">거래처명 <span className="text-red-500">*</span></label>
        <input name="client_name" type="text" required placeholder="예: BHC 본사"
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none" />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">관련 제품 (복수 선택 가능)</label>
        <div className="grid grid-cols-2 gap-2">
          {PRODUCT_CATALOG.slice(0, 8).map((p) => (
            <button key={p.id} type="button" onClick={() => toggleProduct(p.name)}
              className={`text-xs px-3 py-2.5 rounded-xl border font-medium transition-all ${
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
        <label className="text-sm font-medium text-gray-700">클레임 유형</label>
        <select name="claim_type" className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none bg-white">
          <option>품질 이상</option>
          <option>배송 지연</option>
          <option>수량 부족</option>
          <option>포장 불량</option>
          <option>기타</option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700">내용 <span className="text-red-500">*</span></label>
        <textarea name="content" required rows={4} placeholder="클레임 내용을 구체적으로 입력하세요..."
          className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none resize-none" />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 bg-red-600 text-white font-semibold rounded-xl text-sm hover:bg-red-700 active:scale-95 disabled:opacity-60 transition-all">
        {loading ? "접수 중..." : "클레임 접수"}
      </button>
    </form>
  );
}

/* ─── 공용 ─── */
function Field({ label, type, name, placeholder, defaultValue }: {
  label: string; type: string; name: string; placeholder?: string; defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <input type={type} name={name} placeholder={placeholder} defaultValue={defaultValue}
        className="rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#1F3864] outline-none" />
    </div>
  );
}
