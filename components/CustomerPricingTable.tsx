"use client";

import { useState } from "react";
import { upsertCustomerPrice, deleteCustomerPrice, type CustomerProductPrice } from "@/app/actions/pricing";

interface Customer {
  id: string;
  name: string;
}

interface ProductOption {
  code: string;
  name: string;
  sale_price: number;
}

interface Props {
  prices: CustomerProductPrice[];
  customers: Customer[];
  products: ProductOption[];
  isCoo: boolean;
}

export default function CustomerPricingTable({ prices, customers, products, isCoo }: Props) {
  const [rows, setRows] = useState(prices);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [editNotes, setEditNotes] = useState("");
  const [editEffTo, setEditEffTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 새 단가 폼 상태
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newProductCode, setNewProductCode] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [newEffFrom, setNewEffFrom] = useState(new Date().toISOString().split("T")[0]);
  const [newEffTo, setNewEffTo] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // 거래처별 그룹
  const grouped = new Map<string, CustomerProductPrice[]>();
  for (const r of rows) {
    const key = r.customer_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  function startEdit(row: CustomerProductPrice) {
    setEditingId(row.id);
    setEditPrice(row.unit_price);
    setEditNotes(row.notes ?? "");
    setEditEffTo(row.effective_to ?? "");
  }

  async function saveEdit(row: CustomerProductPrice) {
    setLoading(true);
    setMsg(null);
    const result = await upsertCustomerPrice(
      row.customer_id,
      row.customer_name,
      row.product_code,
      row.product_name,
      editPrice,
      row.effective_from,
      editEffTo || null,
      editNotes || null
    );
    if (result.success) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? { ...r, unit_price: editPrice, notes: editNotes || null, effective_to: editEffTo || null }
            : r
        )
      );
      setEditingId(null);
      setMsg({ type: "ok", text: "저장 완료" });
    } else {
      setMsg({ type: "err", text: result.error ?? "저장 실패" });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("이 단가를 삭제하시겠습니까?")) return;
    setLoading(true);
    const result = await deleteCustomerPrice(id);
    if (result.success) {
      setRows((prev) => prev.filter((r) => r.id !== id));
      setMsg({ type: "ok", text: "삭제 완료" });
    } else {
      setMsg({ type: "err", text: result.error ?? "삭제 실패" });
    }
    setLoading(false);
  }

  async function handleAdd() {
    if (!newCustomerId || !newProductCode || newPrice <= 0) {
      setMsg({ type: "err", text: "거래처, 품목, 단가를 모두 입력해주세요." });
      return;
    }
    setLoading(true);
    setMsg(null);

    const customer = customers.find((c) => c.id === newCustomerId);
    const product = products.find((p) => p.code === newProductCode);
    if (!customer || !product) {
      setMsg({ type: "err", text: "거래처 또는 품목을 선택해주세요." });
      setLoading(false);
      return;
    }

    const result = await upsertCustomerPrice(
      newCustomerId,
      customer.name,
      newProductCode,
      product.name,
      newPrice,
      newEffFrom,
      newEffTo || null,
      newNotes || null
    );

    if (result.success) {
      // 목록에 추가 (또는 페이지 새로고침)
      setRows((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          customer_id: newCustomerId,
          customer_name: customer.name,
          product_code: newProductCode,
          product_name: product.name,
          unit_price: newPrice,
          effective_from: newEffFrom,
          effective_to: newEffTo || null,
          notes: newNotes || null,
          updated_by: null,
          updated_at: new Date().toISOString(),
        },
      ]);
      setShowForm(false);
      setNewCustomerId("");
      setNewProductCode("");
      setNewPrice(0);
      setNewEffTo("");
      setNewNotes("");
      setMsg({ type: "ok", text: "단가 추가 완료" });
    } else {
      setMsg({ type: "err", text: result.error ?? "추가 실패" });
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 메시지 */}
      {msg && (
        <div
          className={`px-4 py-2.5 rounded-xl text-sm font-medium ${
            msg.type === "ok" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 단가 추가 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-sm bg-[#1F3864] text-white px-4 py-2 rounded-xl hover:bg-[#2a4a7f] transition-colors font-medium"
        >
          {showForm ? "취소" : "+ 단가 추가"}
        </button>
      </div>

      {/* 단가 추가 폼 */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#1F3864]/20 p-5 flex flex-col gap-3">
          <h3 className="text-sm font-bold text-gray-800">새 거래처 단가 등록</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">거래처</label>
              <select
                value={newCustomerId}
                onChange={(e) => setNewCustomerId(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none bg-white"
              >
                <option value="">거래처 선택</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">품목</label>
              <select
                value={newProductCode}
                onChange={(e) => {
                  setNewProductCode(e.target.value);
                  const p = products.find((p) => p.code === e.target.value);
                  if (p && newPrice === 0) setNewPrice(p.sale_price);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none bg-white"
              >
                <option value="">품목 선택</option>
                {products.map((p) => (
                  <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">단가 (원)</label>
              <input
                type="number"
                value={newPrice || ""}
                onChange={(e) => setNewPrice(Number(e.target.value))}
                placeholder="0"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">적용 시작일</label>
              <input
                type="date"
                value={newEffFrom}
                onChange={(e) => setNewEffFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">적용 종료일 (선택)</label>
              <input
                type="date"
                value={newEffTo}
                onChange={(e) => setNewEffTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">비고</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="비고"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
              />
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="w-full sm:w-auto self-end bg-[#1F3864] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#162c52] disabled:opacity-50 transition-all"
          >
            {loading ? "저장 중..." : "등록"}
          </button>
        </div>
      )}

      {/* 거래처별 단가 테이블 */}
      {grouped.size === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-4xl mb-3">💰</div>
          <div className="font-semibold text-gray-600">등록된 거래처 단가가 없습니다</div>
          <div className="text-sm text-gray-400 mt-1">위의 &quot;단가 추가&quot; 버튼으로 거래처별 단가를 설정하세요</div>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([customerName, customerRows]) => (
          <div key={customerName} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="bg-[#1F3864] text-white px-4 py-2.5 text-sm font-bold flex items-center justify-between">
              <span>{customerName}</span>
              <span className="text-xs text-blue-200">{customerRows.length}개 품목</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">품목</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">단가(원)</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">적용시작</th>
                    <th className="text-center px-3 py-2 text-gray-500 font-medium">적용종료</th>
                    <th className="text-left px-3 py-2 text-gray-500 font-medium">비고</th>
                    <th className="text-right px-3 py-2 text-gray-500 font-medium">수정</th>
                  </tr>
                </thead>
                <tbody>
                  {customerRows.map((row) => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{row.product_name}</td>
                      {editingId === row.id ? (
                        <>
                          <td className="px-3 py-1.5">
                            <input
                              type="number"
                              value={editPrice || ""}
                              onChange={(e) => setEditPrice(Number(e.target.value))}
                              className="w-24 rounded border border-[#1F3864]/30 px-2 py-1 text-xs text-right focus:border-[#1F3864] outline-none"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{row.effective_from}</td>
                          <td className="px-3 py-1.5">
                            <input
                              type="date"
                              value={editEffTo}
                              onChange={(e) => setEditEffTo(e.target.value)}
                              className="rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#1F3864] outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-[#1F3864] outline-none"
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => saveEdit(row)}
                                disabled={loading}
                                className="text-xs bg-emerald-500 text-white px-2 py-1 rounded hover:bg-emerald-600 disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-gray-300"
                              >
                                취소
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2.5 text-right font-bold text-[#1F3864]">
                            {row.unit_price.toLocaleString()}
                          </td>
                          <td className="px-3 py-2.5 text-center text-gray-500">{row.effective_from}</td>
                          <td className="px-3 py-2.5 text-center text-gray-400">
                            {row.effective_to ?? "-"}
                          </td>
                          <td className="px-3 py-2.5 text-gray-400">{row.notes ?? "-"}</td>
                          <td className="px-3 py-2.5 text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => startEdit(row)}
                                className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-2 py-1 rounded hover:bg-[#1F3864]/5"
                              >
                                수정
                              </button>
                              {isCoo && (
                                <button
                                  onClick={() => handleDelete(row.id)}
                                  disabled={loading}
                                  className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                                >
                                  삭제
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
