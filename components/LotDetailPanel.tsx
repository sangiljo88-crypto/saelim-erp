"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getLotDetail,
  addLotMaterial,
  addLotShipment,
  getRecentPurchases,
  getRecentDeliveries,
} from "@/app/actions/lot-tracking";

interface LotDetail {
  lot: {
    id: string;
    lot_number: string;
    production_date: string;
    product_code: string | null;
    product_name: string;
    dept: string | null;
    output_qty: number;
    input_qty: number;
    yield_rate: number | null;
    worker_name: string | null;
    status: string;
    notes: string | null;
  };
  materials: {
    id: string;
    purchase_id: string | null;
    material_name: string;
    supplier: string | null;
    quantity_used: number;
    purchase_date: string | null;
  }[];
  shipments: {
    id: string;
    delivery_id: string | null;
    customer_name: string;
    shipped_qty: number;
    shipped_date: string;
  }[];
}

interface Purchase {
  id: string;
  purchase_date: string;
  material_name: string;
  supplier: string | null;
  quantity: number;
  remaining_qty: number;
  unit: string;
}

interface Delivery {
  id: string;
  delivery_date: string;
  customer_name: string;
  total_amount: number | null;
  status: string;
}

export default function LotDetailPanel({ lotId }: { lotId: string }) {
  const [detail, setDetail] = useState<LotDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 원재료 연결 폼
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState("");
  const [matName, setMatName] = useState("");
  const [matSupplier, setMatSupplier] = useState("");
  const [matQty, setMatQty] = useState("");
  const [matDate, setMatDate] = useState("");
  const [matSaving, setMatSaving] = useState(false);

  // 출하 연결 폼
  const [showShipmentForm, setShowShipmentForm] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState("");
  const [shipCustomer, setShipCustomer] = useState("");
  const [shipQty, setShipQty] = useState("");
  const [shipDate, setShipDate] = useState(new Date().toISOString().split("T")[0]);
  const [shipSaving, setShipSaving] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const d = await getLotDetail(lotId);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "상세 조회 실패");
    } finally {
      setLoading(false);
    }
  }, [lotId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const openMaterialForm = async () => {
    setShowMaterialForm(true);
    try {
      const p = await getRecentPurchases();
      setPurchases(p);
    } catch { /* ignore */ }
  };

  const openShipmentForm = async () => {
    setShowShipmentForm(true);
    try {
      const d = await getRecentDeliveries();
      setDeliveries(d);
    } catch { /* ignore */ }
  };

  const handlePurchaseSelect = (purchaseId: string) => {
    setSelectedPurchase(purchaseId);
    const p = purchases.find((x) => x.id === purchaseId);
    if (p) {
      setMatName(p.material_name);
      setMatSupplier(p.supplier ?? "");
      setMatDate(p.purchase_date);
    }
  };

  const handleDeliverySelect = (deliveryId: string) => {
    setSelectedDelivery(deliveryId);
    const d = deliveries.find((x) => x.id === deliveryId);
    if (d) {
      setShipCustomer(d.customer_name);
      setShipDate(d.delivery_date);
    }
  };

  const saveMaterial = async () => {
    if (!matName || !matQty) return;
    setMatSaving(true);
    try {
      await addLotMaterial(lotId, [{
        purchase_id: selectedPurchase || undefined,
        material_name: matName,
        supplier: matSupplier || undefined,
        quantity_used: Number(matQty),
        purchase_date: matDate || undefined,
      }]);
      setShowMaterialForm(false);
      setSelectedPurchase(""); setMatName(""); setMatSupplier(""); setMatQty(""); setMatDate("");
      await loadDetail();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setMatSaving(false);
    }
  };

  const saveShipment = async () => {
    if (!shipCustomer || !shipQty || !shipDate) return;
    setShipSaving(true);
    try {
      await addLotShipment(lotId, [{
        delivery_id: selectedDelivery || undefined,
        customer_name: shipCustomer,
        shipped_qty: Number(shipQty),
        shipped_date: shipDate,
      }]);
      setShowShipmentForm(false);
      setSelectedDelivery(""); setShipCustomer(""); setShipQty(""); setShipDate(new Date().toISOString().split("T")[0]);
      await loadDetail();
    } catch (e) {
      alert(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setShipSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
        LOT 상세 로딩중...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-red-500">
        {error || "LOT 정보를 불러올 수 없습니다"}
      </div>
    );
  }

  const { lot, materials, shipments } = detail;
  const STATUS_LABELS: Record<string, string> = { produced: "생산완료", shipped: "출하완료", recalled: "회수" };

  return (
    <div className="flex flex-col gap-4">
      {/* LOT 요약 카드 */}
      <div className="bg-white rounded-xl border border-[#1F3864]/20 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#1F3864]">LOT {lot.lot_number}</h3>
          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
            {STATUS_LABELS[lot.status] ?? lot.status}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-xs text-gray-500">생산일</span>
            <div className="font-semibold text-gray-800">{lot.production_date}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">품목</span>
            <div className="font-semibold text-gray-800">{lot.product_name}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">투입/산출</span>
            <div className="font-semibold text-gray-800">
              {Number(lot.input_qty).toLocaleString()}kg &rarr; {Number(lot.output_qty).toLocaleString()}kg
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">수율</span>
            <div className="font-semibold text-amber-600">
              {lot.yield_rate != null ? `${lot.yield_rate}%` : "-"}
            </div>
          </div>
        </div>
        {lot.worker_name && (
          <div className="mt-2 text-xs text-gray-500">작업자: {lot.worker_name} {lot.dept ? `(${lot.dept})` : ""}</div>
        )}
        {lot.notes && (
          <div className="mt-1 text-xs text-gray-500">비고: {lot.notes}</div>
        )}
      </div>

      {/* 역추적: 원재료 출처 */}
      <div className="bg-white rounded-xl border border-orange-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-orange-700">역추적 - 원재료 출처</h4>
          <button
            onClick={openMaterialForm}
            className="text-xs bg-orange-500 text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 transition-colors font-semibold"
          >
            + 원재료 연결
          </button>
        </div>

        {materials.length === 0 ? (
          <div className="text-xs text-gray-400 py-4 text-center">연결된 원재료가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-orange-600">원재료명</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-orange-600">공급사</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-orange-600">사용량</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-orange-600">매입일</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id} className="border-b border-orange-50">
                    <td className="px-3 py-2 text-gray-800 font-medium">{m.material_name}</td>
                    <td className="px-3 py-2 text-gray-600">{m.supplier ?? "-"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{Number(m.quantity_used).toLocaleString()}kg</td>
                    <td className="px-3 py-2 text-gray-600">{m.purchase_date ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 원재료 연결 폼 */}
        {showMaterialForm && (
          <div className="mt-4 border-t border-orange-100 pt-4">
            <h5 className="text-xs font-semibold text-orange-700 mb-3">원재료 배치 연결</h5>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">매입 배치 선택 (선택사항)</label>
                <select
                  value={selectedPurchase}
                  onChange={(e) => handlePurchaseSelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">직접 입력</option>
                  {purchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.purchase_date} | {p.material_name} | {p.supplier ?? "공급사 미상"} | 잔여 {p.remaining_qty}{p.unit}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">원재료명 *</label>
                  <input type="text" value={matName} onChange={(e) => setMatName(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">공급사</label>
                  <input type="text" value={matSupplier} onChange={(e) => setMatSupplier(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">사용량 (kg) *</label>
                  <input type="number" step="0.1" value={matQty} onChange={(e) => setMatQty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">매입일</label>
                  <input type="date" value={matDate} onChange={(e) => setMatDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowMaterialForm(false)} className="text-xs text-gray-500 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
                  취소
                </button>
                <button onClick={saveMaterial} disabled={matSaving} className="text-xs bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 disabled:opacity-50 font-semibold">
                  {matSaving ? "저장중..." : "연결 저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 순추적: 출하 이력 */}
      <div className="bg-white rounded-xl border border-emerald-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-emerald-700">순추적 - 출하 이력</h4>
          <button
            onClick={openShipmentForm}
            className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors font-semibold"
          >
            + 출하 연결
          </button>
        </div>

        {shipments.length === 0 ? (
          <div className="text-xs text-gray-400 py-4 text-center">연결된 출하 이력이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-100">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-emerald-600">거래처</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-emerald-600">출하량</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-emerald-600">출하일</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id} className="border-b border-emerald-50">
                    <td className="px-3 py-2 text-gray-800 font-medium">{s.customer_name}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{Number(s.shipped_qty).toLocaleString()}kg</td>
                    <td className="px-3 py-2 text-gray-600">{s.shipped_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 출하 연결 폼 */}
        {showShipmentForm && (
          <div className="mt-4 border-t border-emerald-100 pt-4">
            <h5 className="text-xs font-semibold text-emerald-700 mb-3">납품 출하 연결</h5>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">납품전표 선택 (선택사항)</label>
                <select
                  value={selectedDelivery}
                  onChange={(e) => handleDeliverySelect(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">직접 입력</option>
                  {deliveries.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.delivery_date} | {d.customer_name} | {d.total_amount ? `${(d.total_amount / 10000).toFixed(0)}만원` : "-"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">거래처 *</label>
                  <input type="text" value={shipCustomer} onChange={(e) => setShipCustomer(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">출하량 (kg) *</label>
                  <input type="number" step="0.1" value={shipQty} onChange={(e) => setShipQty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">출하일 *</label>
                  <input type="date" value={shipDate} onChange={(e) => setShipDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowShipmentForm(false)} className="text-xs text-gray-500 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
                  취소
                </button>
                <button onClick={saveShipment} disabled={shipSaving} className="text-xs bg-emerald-500 text-white px-4 py-2 rounded-lg hover:bg-emerald-600 disabled:opacity-50 font-semibold">
                  {shipSaving ? "저장중..." : "연결 저장"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
