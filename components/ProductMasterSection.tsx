"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { upsertProduct, deleteProduct, bulkUpsertProducts } from "@/app/actions/products";
import type { Product, BulkProductRow } from "@/app/actions/products";

const CATEGORIES = ["전체", "원물", "가공품", "포장재", "부자재"] as const;
const STORAGE_TYPES = ["냉동", "냉장", "상온"];
const UNITS = ["kg", "개", "박스", "두", "L", "ml"];

const EMPTY_PRODUCT: Omit<Product, "id"> = {
  code: "",
  name: "",
  category: "원물",
  subcategory: null,
  unit: "kg",
  purchase_price: 0,
  sale_price: 0,
  storage_type: "냉동",
  storage_area: null,
  is_active: true,
  note: null,
};

interface Props {
  initialProducts: Product[];
}

type EditRow = Omit<Product, "id"> & { id?: string };

type SortKey = "code" | "name" | "category" | "subcategory" | "unit" | "purchase_price" | "sale_price" | "storage_type" | "storage_area";
type SortDir = "asc" | "desc";

export default function ProductMasterSection({ initialProducts }: Props) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [activeCategory, setActiveCategory] = useState<string>("전체");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<EditRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Excel upload state
  const [uploadPreview, setUploadPreview] = useState<BulkProductRow[] | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 정렬 토글 ---
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // --- filtering + sorting ---
  const filtered = products
    .filter((p) => {
      const catOk = activeCategory === "전체" || p.category === activeCategory;
      const q = search.trim().toLowerCase();
      const searchOk = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return catOk && searchOk;
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv), "ko");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  function showMsg(type: "success" | "error", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3500);
  }

  // --- inline edit ---
  function startEdit(product: Product) {
    setIsAddingNew(false);
    setEditingId(product.id);
    setEditData({ ...product });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditData(null);
    setIsAddingNew(false);
  }

  async function saveEdit() {
    if (!editData) return;
    if (!editData.code.trim() || !editData.name.trim()) {
      showMsg("error", "품목코드와 품목명은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const result = await upsertProduct(editData);
      if (!result.success) {
        showMsg("error", result.error ?? "저장 실패");
      } else {
        if (isAddingNew) {
          const tempId = `new-${Date.now()}`;
          const newProduct: Product = { id: tempId, ...editData, is_active: true };
          setProducts((prev) => [...prev, newProduct]);
          showMsg("success", "품목이 추가되었습니다.");
        } else {
          setProducts((prev) =>
            prev.map((p) => (p.id === editData.id ? { ...p, ...editData, id: p.id } : p))
          );
          showMsg("success", "저장되었습니다.");
        }
        cancelEdit();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`"${product.name}" 품목을 비활성화하시겠습니까?`)) return;
    if (product.id.startsWith("f-")) {
      showMsg("error", "DB 미연결 상태에서는 삭제할 수 없습니다.");
      return;
    }
    setSaving(true);
    try {
      const result = await deleteProduct(product.id);
      if (!result.success) {
        showMsg("error", result.error ?? "삭제 실패");
      } else {
        setProducts((prev) => prev.filter((p) => p.id !== product.id));
        showMsg("success", "비활성화되었습니다.");
      }
    } finally {
      setSaving(false);
    }
  }

  function addNewRow() {
    cancelEdit();
    setIsAddingNew(true);
    setEditingId("__new__");
    setEditData({ ...EMPTY_PRODUCT });
  }

  // --- Excel download ---
  function handleExcelDownload() {
    const rows = products.map((p) => ({
      품목코드: p.code,
      품목명: p.name,
      분류: p.category,
      세부분류: p.subcategory ?? "",
      단위: p.unit,
      매입가: p.purchase_price,
      판매가: p.sale_price,
      보관방법: p.storage_type ?? "",
      보관위치: p.storage_area ?? "",
      비고: p.note ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "품목마스터");
    XLSX.writeFile(wb, `새림_품목마스터_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // --- Excel upload ---
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadPreview(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: "" });

        const rows: BulkProductRow[] = json.map((row) => ({
          code: String(row["품목코드"] ?? row["code"] ?? "").trim(),
          name: String(row["품목명"] ?? row["name"] ?? "").trim(),
          category: String(row["분류"] ?? row["category"] ?? "원물").trim(),
          subcategory: String(row["세부분류"] ?? row["subcategory"] ?? "").trim() || null,
          unit: String(row["단위"] ?? row["unit"] ?? "kg").trim(),
          purchase_price: Number(row["매입가"] ?? row["purchase_price"] ?? 0),
          sale_price: Number(row["판매가"] ?? row["sale_price"] ?? 0),
          storage_type: String(row["보관방법"] ?? row["storage_type"] ?? "냉동").trim() || null,
          storage_area: String(row["보관위치"] ?? row["storage_area"] ?? "").trim() || null,
          note: String(row["비고"] ?? row["note"] ?? "").trim() || null,
        })).filter((r) => r.code && r.name);

        if (rows.length === 0) {
          setUploadError("유효한 데이터가 없습니다. 품목코드와 품목명 컬럼이 필요합니다.");
          return;
        }
        setUploadPreview(rows);
      } catch {
        setUploadError("파일 파싱 오류. xlsx/csv 형식인지 확인해주세요.");
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  async function handleBulkUpload() {
    if (!uploadPreview || uploadPreview.length === 0) return;
    setUploading(true);
    try {
      const result = await bulkUpsertProducts(uploadPreview);
      if (!result.success) {
        setUploadError(result.error ?? "업로드 실패");
      } else {
        showMsg("success", `${result.count}개 품목이 업데이트되었습니다. 새로고침하면 반영됩니다.`);
        setUploadPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      setUploading(false);
    }
  }

  function cancelUpload() {
    setUploadPreview(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- edit field helper ---
  function setField<K extends keyof EditRow>(key: K, value: EditRow[K]) {
    setEditData((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toast */}
      {msg && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
          msg.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {msg.text}
        </div>
      )}

      {/* 탭 + 검색 */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeCategory === cat
                  ? "bg-[#1F3864] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="품목명/코드 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-60 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
        />
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="bg-[#1F3864] text-white text-xs">
                {(
                  [
                    { key: "code",           label: "품목코드",  align: "left",   w: "w-24" },
                    { key: "name",           label: "품목명",    align: "left",   w: "w-36" },
                    { key: "category",       label: "분류",      align: "left",   w: "w-20" },
                    { key: "subcategory",    label: "세부분류",  align: "left",   w: "w-24" },
                    { key: "unit",           label: "단위",      align: "center", w: "w-16" },
                    { key: "purchase_price", label: "매입가(원)",align: "right",  w: "w-24" },
                    { key: "sale_price",     label: "판매가(원)",align: "right",  w: "w-24" },
                    { key: "storage_type",   label: "보관방법",  align: "center", w: "w-20" },
                    { key: "storage_area",   label: "보관위치",  align: "left",   w: "w-28" },
                  ] as { key: SortKey; label: string; align: string; w: string }[]
                ).map(({ key, label, align, w }) => {
                  const active = sortKey === key;
                  const icon = active ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
                  return (
                    <th
                      key={key}
                      className={`px-3 py-3 font-semibold ${w} text-${align} cursor-pointer select-none hover:bg-[#162c52] transition-colors`}
                      onClick={() => toggleSort(key)}
                    >
                      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                        {label}
                        <span className={`text-[10px] ${active ? "text-yellow-300" : "text-white/40"}`}>{icon}</span>
                      </span>
                    </th>
                  );
                })}
                <th className="text-center px-3 py-3 font-semibold w-16">상태</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {/* 새 행 추가 */}
              {isAddingNew && editData && (
                <tr className="bg-blue-50 border-l-4 border-[#1F3864]">
                  <EditRowCells
                    data={editData}
                    setField={setField}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    saving={saving}
                  />
                </tr>
              )}

              {filtered.length === 0 && !isAddingNew ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-400 text-sm">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  editingId === product.id && editData ? (
                    <tr key={product.id} className="bg-blue-50 border-l-4 border-[#1F3864]">
                      <EditRowCells
                        data={editData}
                        setField={setField}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                        saving={saving}
                      />
                    </tr>
                  ) : (
                    <tr
                      key={product.id}
                      className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => startEdit(product)}
                    >
                      <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{product.code}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{product.name}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          product.category === "원물" ? "bg-amber-100 text-amber-700"
                          : product.category === "가공품" ? "bg-blue-100 text-blue-700"
                          : product.category === "포장재" ? "bg-purple-100 text-purple-700"
                          : "bg-gray-100 text-gray-600"
                        }`}>{product.category}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{product.subcategory ?? "-"}</td>
                      <td className="px-3 py-2.5 text-center text-xs text-gray-600">{product.unit}</td>
                      <td className="px-3 py-2.5 text-right text-xs text-gray-700">
                        {product.purchase_price > 0 ? product.purchase_price.toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-xs font-semibold text-[#1F3864]">
                        {product.sale_price > 0 ? product.sale_price.toLocaleString() : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          product.storage_type === "냉동" ? "bg-sky-100 text-sky-700"
                          : product.storage_type === "냉장" ? "bg-cyan-100 text-cyan-700"
                          : "bg-orange-100 text-orange-700"
                        }`}>{product.storage_type ?? "-"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-500">{product.storage_area ?? "-"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          product.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                        }`}>{product.is_active ? "활성" : "비활성"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(product)}
                          className="text-xs text-gray-300 hover:text-red-400 transition-colors px-2 py-1 rounded"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  )
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 하단 카운트 */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-xs text-gray-400">
          <span>총 {filtered.length}개 품목</span>
          <span className="text-gray-300">행 클릭 시 편집 모드</span>
        </div>
      </div>

      {/* 하단 버튼 영역 */}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          onClick={addNewRow}
          className="px-4 py-2 bg-[#1F3864] text-white text-sm font-medium rounded-xl hover:bg-[#162c52] transition-colors"
        >
          + 품목 추가
        </button>

        <button
          onClick={handleExcelDownload}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors text-gray-700"
        >
          엑셀 다운로드
        </button>

        <label className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors text-gray-700 cursor-pointer">
          엑셀 업로드
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      </div>

      {/* 업로드 오류 */}
      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          {uploadError}
        </div>
      )}

      {/* 업로드 미리보기 */}
      {uploadPreview && uploadPreview.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <div>
              <span className="text-sm font-semibold text-gray-700">업로드 미리보기</span>
              <span className="ml-2 text-xs text-gray-400">총 {uploadPreview.length}개 행 (최대 10행 표시)</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={cancelUpload}
                className="px-3 py-1.5 border border-gray-300 text-xs rounded-lg hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleBulkUpload}
                disabled={uploading}
                className="px-4 py-1.5 bg-[#1F3864] text-white text-xs font-medium rounded-lg hover:bg-[#162c52] disabled:opacity-50"
              >
                {uploading ? "업로드 중..." : "이 데이터로 업데이트"}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[700px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 text-gray-500">코드</th>
                  <th className="text-left px-3 py-2 text-gray-500">품목명</th>
                  <th className="text-left px-3 py-2 text-gray-500">분류</th>
                  <th className="text-left px-3 py-2 text-gray-500">세부분류</th>
                  <th className="text-center px-3 py-2 text-gray-500">단위</th>
                  <th className="text-right px-3 py-2 text-gray-500">매입가</th>
                  <th className="text-right px-3 py-2 text-gray-500">판매가</th>
                  <th className="text-center px-3 py-2 text-gray-500">보관방법</th>
                </tr>
              </thead>
              <tbody>
                {uploadPreview.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2 font-mono text-gray-500">{row.code}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                    <td className="px-3 py-2 text-gray-600">{row.category}</td>
                    <td className="px-3 py-2 text-gray-500">{row.subcategory ?? "-"}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{row.unit}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.purchase_price?.toLocaleString() ?? 0}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{row.sale_price?.toLocaleString() ?? 0}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{row.storage_type ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {uploadPreview.length > 10 && (
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100 bg-gray-50">
              ... 외 {uploadPreview.length - 10}개 행
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- 인라인 편집 셀 컴포넌트 ---
interface EditRowCellsProps {
  data: EditRow;
  setField: <K extends keyof EditRow>(key: K, value: EditRow[K]) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

function EditRowCells({ data, setField, onSave, onCancel, saving }: EditRowCellsProps) {
  return (
    <>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.code}
          onChange={(e) => setField("code", e.target.value)}
          placeholder="코드"
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none font-mono"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="품목명"
          autoFocus
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={data.category}
          onChange={(e) => setField("category", e.target.value)}
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none bg-white"
        >
          {["원물", "가공품", "포장재", "부자재"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.subcategory ?? ""}
          onChange={(e) => setField("subcategory", e.target.value || null)}
          placeholder="세부분류"
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={data.unit}
          onChange={(e) => setField("unit", e.target.value)}
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none bg-white"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          value={data.purchase_price || ""}
          onChange={(e) => setField("purchase_price", Number(e.target.value))}
          placeholder="0"
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs text-right focus:border-[#1F3864] outline-none"
        />
      </td>
      <td className="px-2 py-2">
        <input
          type="number"
          value={data.sale_price || ""}
          onChange={(e) => setField("sale_price", Number(e.target.value))}
          placeholder="0"
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs text-right focus:border-[#1F3864] outline-none"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={data.storage_type ?? "냉동"}
          onChange={(e) => setField("storage_type", e.target.value || null)}
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none bg-white"
        >
          {STORAGE_TYPES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          value={data.storage_area ?? ""}
          onChange={(e) => setField("storage_area", e.target.value || null)}
          placeholder="보관위치"
          className="w-full rounded-lg border border-[#1F3864]/30 px-2 py-1.5 text-xs focus:border-[#1F3864] outline-none"
        />
      </td>
      <td className="px-2 py-2 text-center">
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">활성</span>
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1">
          <button
            onClick={onSave}
            disabled={saving}
            className="px-2 py-1 bg-[#1F3864] text-white text-xs rounded-lg hover:bg-[#162c52] disabled:opacity-50"
          >
            {saving ? "..." : "저장"}
          </button>
          <button
            onClick={onCancel}
            className="px-2 py-1 border border-gray-300 text-xs rounded-lg hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      </td>
    </>
  );
}
