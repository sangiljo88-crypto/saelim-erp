"use client";

import { useState } from "react";
import { recordMaterialPurchase, updatePurchaseRemaining } from "@/app/actions/submit";
import { calculateFifo, calculateWeightedAvg, type PurchaseBatch } from "@/lib/fifo";

interface Purchase {
  id: string;
  purchase_date: string;
  material_name: string;
  product_code: string | null;
  supplier: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  total_cost: number;
  remaining_qty: number;
  invoice_no: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

interface Product {
  code: string;
  name: string;
  category: string;
  purchase_price: number;
  unit: string;
}

interface FifoStock {
  id: string;
  purchase_date: string;
  created_at: string;
  material_name: string;
  unit_price: number;
  quantity: number;
  remaining_qty: number;
  unit: string;
  supplier: string | null;
}

interface Props {
  purchases: Purchase[];
  products: Product[];
  suppliers: string[];
  fifoStocks: FifoStock[];
  materialTotals: Record<string, { cost: number; qty: number; unit: string }>;
  initialFrom: string;
  initialTo: string;
  canEdit: boolean;
}

const UNITS = ["kg", "두", "개", "장", "박스", "L", "묶음"];

// 원재료 입고 창고 (frozen_inventory section 기준)
const RAW_SECTIONS = [
  "2번냉동실",
  "3번냉동실",
  "(1번)왼쪽컨테이너",
  "(2번)오른쪽컨테이너",
  "4번냉동고(가공)",
  "5번냉동고(발골)",
];

// 기본 공급업체 (기존에 없을 때 보여줄 기본값)
const DEFAULT_SUPPLIERS = ["농협", "목욕촌", "한돈유통"];

const EMPTY_FORM = {
  purchase_date: "",
  material_name: "",
  product_code: "",
  supplier: "",
  storage_section: "",
  quantity: 0,
  unit: "kg",
  unit_price: 0,
  total_cost: 0,
  invoice_no: "",
  notes: "",
};

function remainingColor(ratio: number) {
  if (ratio <= 0)   return "bg-gray-300";
  if (ratio < 0.5)  return "bg-orange-400";
  if (ratio < 1.0)  return "bg-blue-400";
  return "bg-emerald-400";
}

function remainingLabel(ratio: number) {
  if (ratio <= 0)  return { text: "소진", cls: "text-gray-400" };
  if (ratio < 0.5) return { text: "50% 미만", cls: "text-orange-500" };
  if (ratio < 1.0) return { text: "잔여", cls: "text-blue-500" };
  return { text: "신규", cls: "text-emerald-500" };
}

// FIFO 배치 색상 팔레트 (단가 구간별 시각화)
const BATCH_COLORS = [
  "bg-[#1F3864]", "bg-blue-500", "bg-indigo-400",
  "bg-violet-400", "bg-purple-400", "bg-fuchsia-400",
];
const BATCH_TEXT_COLORS = [
  "text-[#1F3864]", "text-blue-600", "text-indigo-600",
  "text-violet-600", "text-purple-600", "text-fuchsia-600",
];

export default function PurchaseManager({
  purchases: initialPurchases,
  products,
  suppliers: dbSuppliers,
  fifoStocks,
  materialTotals,
  initialFrom,
  initialTo,
  canEdit,
}: Props) {
  const [purchases, setPurchases] = useState<Purchase[]>(initialPurchases);
  const [from, setFrom]           = useState(initialFrom);
  const [to, setTo]               = useState(initialTo);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...EMPTY_FORM });
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState("");

  // 원재료명 입력 모드: "select" = 기존 제품 선택 / "direct" = 직접 입력
  const [materialMode, setMaterialMode] = useState<"select" | "direct">("select");
  // 공급업체 입력 모드
  const [supplierMode, setSupplierMode] = useState<"select" | "direct">("select");

  // 잔여수량 인라인 편집
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editingQty, setEditingQty] = useState<number>(0);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr]       = useState("");

  const today = new Date().toISOString().split("T")[0];

  // FIFO 현황 섹션 토글
  const [showFifo, setShowFifo] = useState(true);
  // 소비 시뮬레이터: { [material_name]: qty }
  const [simQty, setSimQty] = useState<Record<string, number>>({});

  // fifoStocks를 material_name별로 그룹핑 (이미 purchase_date ASC, created_at ASC 정렬됨)
  const fifoGroups: Record<string, PurchaseBatch[]> = {};
  for (const s of fifoStocks) {
    if (!fifoGroups[s.material_name]) fifoGroups[s.material_name] = [];
    fifoGroups[s.material_name].push({
      id:            s.id,
      purchase_date: s.purchase_date,
      created_at:    s.created_at,
      material_name: s.material_name,
      unit_price:    s.unit_price,
      quantity:      s.quantity,
      remaining_qty: s.remaining_qty,
    });
  }

  // 공급업체 목록 (DB 기존 + 기본값 합치기, 중복 제거)
  const allSuppliers = Array.from(new Set([...DEFAULT_SUPPLIERS, ...dbSuppliers])).sort();

  // TOP3 원재료
  const top3 = Object.entries(materialTotals)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 3);
  const totalCost = Object.values(materialTotals).reduce((s, v) => s + v.cost, 0);

  // 소진 현황
  const exhausted = purchases.filter((p) => p.remaining_qty <= 0).length;
  const half      = purchases.filter((p) => p.remaining_qty > 0 && p.remaining_qty / p.quantity >= 0.5).length;
  const fresh     = purchases.filter((p) => p.remaining_qty === p.quantity).length;

  // 제품 선택 → form 자동채움
  function applyProduct(code: string) {
    if (code === "__direct__") {
      setMaterialMode("direct");
      setForm((prev) => ({ ...prev, material_name: "", product_code: "" }));
      return;
    }
    const found = products.find((p) => p.code === code);
    if (!found) return;
    setMaterialMode("select");
    setForm((prev) => ({
      ...prev,
      material_name: found.name,
      product_code:  found.code,
      unit:          found.unit || "kg",
      unit_price:    found.purchase_price || 0,
      total_cost:    (found.purchase_price || 0) * (prev.quantity || 0),
    }));
  }

  // 공급업체 선택
  function applySupplier(value: string) {
    if (value === "__direct__") {
      setSupplierMode("direct");
      setForm((prev) => ({ ...prev, supplier: "" }));
    } else {
      setSupplierMode("select");
      setForm((prev) => ({ ...prev, supplier: value }));
    }
  }

  function handleQtyOrPrice(field: "quantity" | "unit_price", value: number) {
    setForm((prev) => {
      const qty   = field === "quantity"   ? value : prev.quantity;
      const price = field === "unit_price" ? value : prev.unit_price;
      return { ...prev, [field]: value, total_cost: qty * price };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.purchase_date || !form.material_name || !form.quantity || !form.unit_price) {
      setSaveErr("구매일, 원재료명, 수량, 단가는 필수입니다");
      return;
    }
    setSaving(true);
    setSaveErr("");
    try {
      const res = await recordMaterialPurchase({
        purchase_date:   form.purchase_date,
        material_name:   form.material_name,
        product_code:    form.product_code  || null,
        supplier:        form.supplier      || "",
        quantity:        form.quantity,
        unit:            form.unit,
        unit_price:      form.unit_price,
        invoice_no:      form.invoice_no    || "",
        notes:           form.notes         || "",
        storage_section: form.storage_section || undefined,
      });
      if (res && "error" in res && res.error) throw new Error(res.error);
      // 로컬 state에 임시 추가
      const newEntry: Purchase = {
        id:            crypto.randomUUID(),
        purchase_date: form.purchase_date,
        material_name: form.material_name,
        product_code:  form.product_code  || null,
        supplier:      form.supplier      || null,
        quantity:      form.quantity,
        unit:          form.unit,
        unit_price:    form.unit_price,
        total_cost:    form.total_cost,
        remaining_qty: form.quantity,
        invoice_no:    form.invoice_no    || null,
        notes:         form.notes         || null,
        recorded_by:   "방금 저장됨",
        created_at:    new Date().toISOString(),
      };
      setPurchases((prev) => [newEntry, ...prev]);
      setForm({ ...EMPTY_FORM, purchase_date: today });
      setMaterialMode("select");
      setSupplierMode("select");
      setShowForm(false);
    } catch (err) {
      setSaveErr((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveRemaining(id: string) {
    setEditSaving(true);
    setEditErr("");
    try {
      const res = await updatePurchaseRemaining(id, editingQty);
      if (res && "error" in res && res.error) throw new Error(res.error);
      setPurchases((prev) =>
        prev.map((p) => p.id === id ? { ...p, remaining_qty: editingQty } : p)
      );
      setEditingId(null);
    } catch (err) {
      setEditErr((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">

      {/* 기간 필터 바 */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-bold text-gray-600">기간 조회</span>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
        />
        <span className="text-xs text-gray-400">~</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
        />
        <button
          onClick={() => { window.location.href = `/purchases?from=${from}&to=${to}`; }}
          className="bg-[#1F3864] text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-[#2a4a7f] cursor-pointer"
        >
          조회
        </button>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-[#1F3864]">{purchases.length}</div>
          <div className="text-xs text-gray-500 mt-1">매입 건수</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-[#1F3864]">
            {totalCost > 0 ? `${(totalCost / 10000).toLocaleString()}만원` : "0원"}
          </div>
          <div className="text-xs text-gray-500 mt-1">총 매입금액</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs font-bold text-gray-600 mb-2">원재료 TOP3</div>
          {top3.length === 0 ? (
            <div className="text-xs text-gray-400 text-center py-2">데이터 없음</div>
          ) : (
            <div className="flex flex-col gap-2">
              {top3.map(([name, val]) => {
                const ratio = totalCost > 0 ? val.cost / totalCost : 0;
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-700 font-medium truncate max-w-[120px]">{name}</span>
                      <span className="text-xs text-gray-500 shrink-0 ml-1">
                        {(val.cost / 10000).toLocaleString()}만원
                        <span className="text-gray-400 ml-1">({(ratio * 100).toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#1F3864] rounded-full"
                        style={{ width: `${(ratio * 100).toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FIFO 원가 현황 ─────────────────────────── */}
      {Object.keys(fifoGroups).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* 헤더 */}
          <button
            type="button"
            onClick={() => setShowFifo(!showFifo)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">📊 FIFO 원가 현황</span>
              <span className="text-xs bg-[#1F3864]/10 text-[#1F3864] px-2 py-0.5 rounded-full font-semibold">
                {Object.keys(fifoGroups).length}개 품목 잔여
              </span>
            </div>
            <span className="text-xs text-gray-400">{showFifo ? "▲ 접기" : "▼ 펼치기"}</span>
          </button>

          {showFifo && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {Object.entries(fifoGroups).map(([material, batches]) => {
                const unit         = fifoStocks.find((s) => s.material_name === material)?.unit ?? "";
                const totalRemain  = batches.reduce((s, b) => s + b.remaining_qty, 0);
                const totalQty     = batches.reduce((s, b) => s + b.quantity, 0);
                const weightedAvg  = calculateWeightedAvg(batches);
                const totalValue   = Math.round(totalRemain * weightedAvg);
                const consume      = simQty[material] ?? 0;
                const simResult    = consume > 0 ? calculateFifo(batches, consume) : null;

                return (
                  <div key={material} className="px-4 py-4">
                    {/* 품목 헤더 */}
                    <div className="flex items-start justify-between gap-2 mb-3 flex-wrap">
                      <div>
                        <span className="text-sm font-bold text-gray-800">{material}</span>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                          <span>잔여 <strong className="text-gray-700">{totalRemain.toLocaleString()}{unit}</strong></span>
                          <span>가중평균 <strong className="text-[#1F3864]">{weightedAvg.toLocaleString()}원/{unit}</strong></span>
                          <span>평가액 <strong className="text-gray-700">{(totalValue / 10000).toLocaleString()}만원</strong></span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{batches.length}배치</div>
                    </div>

                    {/* FIFO 배치 레이어 시각화 */}
                    <div className="mb-3">
                      {/* 가격 레이어 바 (너비 = 각 배치 remaining_qty 비율) */}
                      <div className="flex h-5 rounded-lg overflow-hidden gap-px bg-gray-100">
                        {batches.map((b, i) => {
                          const ratio = totalRemain > 0 ? (b.remaining_qty / totalRemain) * 100 : 0;
                          return (
                            <div
                              key={b.id}
                              title={`${b.purchase_date} · ${b.remaining_qty.toLocaleString()}${unit} · ${b.unit_price.toLocaleString()}원/${unit}`}
                              className={`${BATCH_COLORS[i % BATCH_COLORS.length]} transition-all`}
                              style={{ width: `${ratio}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>

                    {/* 배치 목록 (FIFO 순서 = 오래된 것 먼저) */}
                    <div className="flex flex-col gap-1.5 mb-3">
                      {batches.map((b, i) => {
                        const usedRatio = b.quantity > 0 ? (b.remaining_qty / b.quantity) : 0;
                        const isFirst   = i === 0;
                        return (
                          <div key={b.id}
                            className="flex items-center gap-2 text-xs flex-wrap">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${BATCH_COLORS[i % BATCH_COLORS.length]}`}>
                              {i + 1}
                            </span>
                            {isFirst && (
                              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                선입 우선
                              </span>
                            )}
                            <span className="text-gray-400">{b.purchase_date}</span>
                            <span className={`font-bold ${BATCH_TEXT_COLORS[i % BATCH_TEXT_COLORS.length]}`}>
                              {b.unit_price.toLocaleString()}원/{unit}
                            </span>
                            <span className="text-gray-400">×</span>
                            <span className="text-gray-600 font-medium">
                              잔여 {b.remaining_qty.toLocaleString()}/{b.quantity.toLocaleString()}{unit}
                            </span>
                            {/* 잔여 비율 미니바 */}
                            <div className="flex-1 min-w-[60px] max-w-[100px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${BATCH_COLORS[i % BATCH_COLORS.length]} opacity-60`}
                                style={{ width: `${(usedRatio * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="text-gray-400">
                              = {(b.remaining_qty * b.unit_price / 10000).toLocaleString()}만원
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* 소비 시뮬레이터 */}
                    <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500 font-medium">🔢 소비 시뮬레이터</span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={simQty[material] || ""}
                            onChange={(e) =>
                              setSimQty((prev) => ({
                                ...prev,
                                [material]: Number(e.target.value) || 0,
                              }))
                            }
                            placeholder="0"
                            min={0}
                            max={totalRemain}
                            step="any"
                            className="w-24 border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30 text-center"
                          />
                          <span className="text-xs text-gray-400">{unit} 소비 시</span>
                        </div>
                        {simResult && (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[#1F3864] font-bold">
                              → {(simResult.totalCost / 10000).toLocaleString()}만원
                            </span>
                            <span className="text-gray-400">
                              (평균 {simResult.avgUnitPrice.toLocaleString()}원/{unit})
                            </span>
                            {simResult.unallocated > 0 && (
                              <span className="text-red-500">
                                ⚠ {simResult.unallocated.toLocaleString()}{unit} 재고 부족
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 시뮬레이션 배치 내역 */}
                      {simResult && simResult.batchDetails.length > 0 && (
                        <div className="mt-2 flex flex-col gap-0.5 border-t border-gray-200 pt-2">
                          {simResult.batchDetails.map((d, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${BATCH_COLORS[i % BATCH_COLORS.length]}`}>
                                {i + 1}
                              </span>
                              <span>{d.purchase_date}</span>
                              <span className={`font-semibold ${BATCH_TEXT_COLORS[i % BATCH_TEXT_COLORS.length]}`}>
                                {d.unit_price.toLocaleString()}원
                              </span>
                              <span>×</span>
                              <span>{d.consumed.toLocaleString()}{unit}</span>
                              <span className="text-gray-400">=</span>
                              <span className="font-semibold text-gray-700">
                                {(d.cost / 10000).toLocaleString()}만원
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 매입 등록 폼 토글 */}
      {canEdit && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-600">매입 기록</span>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setForm({ ...EMPTY_FORM, purchase_date: today });
                setMaterialMode("select");
                setSupplierMode("select");
                setSaveErr("");
              }}
              className="flex items-center gap-1 text-xs bg-[#1F3864] text-white px-4 py-2 rounded-lg font-semibold hover:bg-[#2a4a7f] cursor-pointer"
            >
              {showForm ? "✕ 취소" : "+ 매입 등록"}
            </button>
          </div>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="bg-white border border-[#1F3864]/20 rounded-xl px-5 py-4 flex flex-col gap-4"
            >
              <div className="text-sm font-bold text-[#1F3864]">📦 원재료 매입 등록</div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* 구매일 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">구매일 *</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => setForm((p) => ({ ...p, purchase_date: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required
                  />
                </div>

                {/* 입고 창고 (재고 자동 반영) */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    입고 창고
                    <span className="ml-1 text-blue-400 text-[10px]">선택 시 재고 자동 반영</span>
                  </label>
                  <select
                    value={form.storage_section}
                    onChange={(e) => setForm((p) => ({ ...p, storage_section: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                  >
                    <option value="">-- 미지정 (재고 미반영) --</option>
                    {RAW_SECTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* 원재료명 */}
                <div className="sm:col-span-2">
                  <label className="text-xs text-gray-500 block mb-1">원재료명 *</label>
                  {materialMode === "select" ? (
                    <select
                      value={
                        products.find((p) => p.name === form.material_name)?.code ?? ""
                      }
                      onChange={(e) => applyProduct(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    >
                      <option value="">-- 원재료 선택 --</option>
                      {["원물", "포장재", "부자재"].map((cat) => {
                        const catProducts = products.filter((p) => p.category === cat);
                        if (catProducts.length === 0) return null;
                        return (
                          <optgroup key={cat} label={`── ${cat} ──`}>
                            {catProducts.map((p) => (
                              <option key={p.code} value={p.code}>
                                {p.name} · 기준가 {p.purchase_price.toLocaleString()}원/{p.unit}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                      <option value="__direct__">✏️ 직접 입력 (목록에 없음)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.material_name}
                        onChange={(e) => setForm((p) => ({ ...p, material_name: e.target.value }))}
                        placeholder="원재료명 직접 입력"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                        autoFocus
                        required
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setMaterialMode("select");
                          setForm((p) => ({ ...p, material_name: "", product_code: "" }));
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        목록 선택
                      </button>
                    </div>
                  )}
                  {form.product_code && materialMode === "select" && (
                    <div className="mt-1 text-xs text-emerald-600">
                      선택됨: {form.material_name} <span className="text-gray-400">({form.product_code})</span>
                    </div>
                  )}
                </div>

                {/* 공급업체 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공급업체</label>
                  {supplierMode === "select" ? (
                    <select
                      value={form.supplier}
                      onChange={(e) => applySupplier(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    >
                      <option value="">-- 공급업체 선택 --</option>
                      {allSuppliers.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                      <option value="__direct__">✏️ 새 공급업체 추가</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.supplier}
                        onChange={(e) => setForm((p) => ({ ...p, supplier: e.target.value }))}
                        placeholder="공급업체명 입력"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierMode("select");
                          setForm((p) => ({ ...p, supplier: "" }));
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        목록 선택
                      </button>
                    </div>
                  )}
                </div>

                {/* 제품코드 (자동채움 or 직접) */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">제품코드</label>
                  <input
                    type="text"
                    value={form.product_code}
                    onChange={(e) => setForm((p) => ({ ...p, product_code: e.target.value }))}
                    placeholder="ex) RAW-001 (자동채움)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                  />
                </div>

                {/* 수량 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">수량 *</label>
                  <input
                    type="number"
                    value={form.quantity || ""}
                    onChange={(e) => handleQtyOrPrice("quantity", Number(e.target.value) || 0)}
                    placeholder="0"
                    min={0}
                    step="any"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required
                  />
                </div>

                {/* 단위 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">단위 *</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* 단가 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">단가 (원/{form.unit}) *</label>
                  <input
                    type="number"
                    value={form.unit_price || ""}
                    onChange={(e) => handleQtyOrPrice("unit_price", Number(e.target.value) || 0)}
                    placeholder="0"
                    min={0}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                    required
                  />
                </div>

                {/* 총금액 자동계산 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">총금액 (자동계산)</label>
                  <div className="w-full border border-blue-200 bg-blue-50 rounded-lg px-3 py-1.5 text-sm font-bold text-blue-700">
                    {form.total_cost.toLocaleString()}원
                    {form.total_cost > 0 && (
                      <span className="ml-2 text-xs font-normal text-blue-400">
                        ({(form.total_cost / 10000).toFixed(1)}만원)
                      </span>
                    )}
                  </div>
                </div>

                {/* 거래명세서번호 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">거래명세서번호</label>
                  <input
                    type="text"
                    value={form.invoice_no}
                    onChange={(e) => setForm((p) => ({ ...p, invoice_no: e.target.value }))}
                    placeholder="ex) INV-2026-0413"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                  />
                </div>

                {/* 비고 */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">비고</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    placeholder="ex) 급랭 입고, 냉동 보관"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                  />
                </div>
              </div>

              {form.storage_section && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  ✅ 저장 시 <strong>{form.storage_section}</strong>에 입고 수량 자동 반영됩니다
                </div>
              )}

              {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}

              <button
                type="submit"
                disabled={saving}
                className="self-start bg-[#1F3864] text-white text-sm font-semibold px-6 py-2 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer"
              >
                {saving ? "저장중…" : "💾 매입 저장"}
              </button>
            </form>
          )}
        </div>
      )}

      {/* 매입 이력 목록 */}
      {purchases.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          해당 기간에 등록된 매입 기록이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {purchases.map((p) => {
            const ratio     = p.quantity > 0 ? p.remaining_qty / p.quantity : 0;
            const barColor  = remainingColor(ratio);
            const lbl       = remainingLabel(ratio);
            const isEditing = editingId === p.id;

            return (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-col gap-2"
              >
                {/* 상단 행 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-gray-800">{p.material_name}</span>
                      {p.product_code && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                          {p.product_code}
                        </span>
                      )}
                      <span className={`text-xs font-semibold ${lbl.cls}`}>{lbl.text}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {p.purchase_date}
                      {p.supplier && <span> · {p.supplier}</span>}
                      {p.recorded_by && <span> · {p.recorded_by}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold text-[#1F3864]">
                      {(p.total_cost || 0).toLocaleString()}원
                    </div>
                    <div className="text-xs text-gray-400">
                      {p.quantity.toLocaleString()}{p.unit} · {(p.unit_price || 0).toLocaleString()}원/{p.unit}
                    </div>
                  </div>
                </div>

                {/* 잔여수량 progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      잔여 {p.remaining_qty.toLocaleString()}{p.unit} / {p.quantity.toLocaleString()}{p.unit}
                    </span>
                    {canEdit && !isEditing && (
                      <button
                        onClick={() => {
                          setEditingId(p.id);
                          setEditingQty(p.remaining_qty);
                          setEditErr("");
                        }}
                        className="text-xs text-gray-400 hover:text-[#1F3864] cursor-pointer flex items-center gap-1"
                        title="잔여수량 수정"
                      >
                        ✏️ 수정
                      </button>
                    )}
                    {canEdit && isEditing && (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={editingQty}
                          onChange={(e) => setEditingQty(Number(e.target.value) || 0)}
                          min={0}
                          max={p.quantity}
                          step="any"
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-[#1F3864]/30"
                        />
                        <span className="text-xs text-gray-400">{p.unit}</span>
                        <button
                          onClick={() => handleSaveRemaining(p.id)}
                          disabled={editSaving}
                          className="text-xs bg-[#1F3864] text-white px-2 py-1 rounded-lg hover:bg-[#2a4a7f] disabled:opacity-50 cursor-pointer"
                        >
                          {editSaving ? "…" : "저장"}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditErr(""); }}
                          className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor}`}
                      style={{ width: `${Math.min(ratio * 100, 100).toFixed(1)}%` }}
                    />
                  </div>
                  {editErr && editingId === p.id && (
                    <p className="text-xs text-red-500 mt-1">{editErr}</p>
                  )}
                </div>

                {/* 추가 정보 */}
                {(p.invoice_no || p.notes) && (
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 border-t border-gray-100 pt-2">
                    {p.invoice_no && (
                      <span>
                        <span className="text-gray-400">명세서: </span>{p.invoice_no}
                      </span>
                    )}
                    {p.notes && (
                      <span>
                        <span className="text-gray-400">비고: </span>{p.notes}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 소진 현황 안내 */}
      {purchases.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex flex-wrap gap-4 text-xs text-gray-600">
          <span>✅ 소진된 배치 <strong>{exhausted}건</strong></span>
          <span>🟡 50% 이상 잔여 <strong>{half}건</strong></span>
          <span>📦 신규(100%) <strong>{fresh}건</strong></span>
        </div>
      )}
    </div>
  );
}
