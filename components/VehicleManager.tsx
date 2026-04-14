"use client";

import { useState } from "react";
import { upsertVehicle } from "@/app/actions/dispatch";

interface Vehicle {
  id: string;
  vehicle_name: string;
  vehicle_number: string;
  vehicle_type: string;
  capacity_ton: number | null;
  fuel_type: string;
  fuel_efficiency: number;
  last_mileage: number;
  notes: string | null;
}

interface Props {
  vehicles: Vehicle[];
  canManage: boolean;
}

export default function VehicleManager({ vehicles, canManage }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 폼 상태
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [type, setType] = useState("냉동");
  const [capacity, setCapacity] = useState<number>(1);
  const [fuelType, setFuelType] = useState("경유");
  const [efficiency, setEfficiency] = useState<number>(8);
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    if (!name || !number) {
      setMsg({ type: "err", text: "차량명과 차량번호를 입력해주세요." });
      return;
    }

    setLoading(true);
    setMsg(null);

    const result = await upsertVehicle({
      vehicle_name: name,
      vehicle_number: number,
      vehicle_type: type,
      capacity_ton: capacity || undefined,
      fuel_type: fuelType,
      fuel_efficiency: efficiency || 8,
      notes: notes || undefined,
    });

    setLoading(false);
    if (result.success) {
      setMsg({ type: "ok", text: "차량이 등록되었습니다." });
      setShowForm(false);
      setName("");
      setNumber("");
      setNotes("");
    } else {
      setMsg({ type: "err", text: result.error ?? "오류가 발생했습니다." });
    }
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800">차량 관리</h2>
        {canManage && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-xs text-[#1F3864] border border-[#1F3864]/30 px-3 py-1.5 rounded-lg hover:bg-[#1F3864]/5 transition-colors font-medium"
          >
            {showForm ? "닫기" : "+ 차량 추가"}
          </button>
        )}
      </div>

      {/* 알림 */}
      {msg && (
        <div
          className={`mx-4 mt-3 px-4 py-2.5 rounded-xl text-xs font-medium ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 차량 추가 폼 */}
      {showForm && canManage && (
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">차량명 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 1톤냉동"
                className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">차량번호 *</label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="예: 12가3456"
                className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none bg-white"
              >
                <option value="냉동">냉동</option>
                <option value="냉장">냉장</option>
                <option value="상온">상온</option>
                <option value="윙바디">윙바디</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">적재량 (톤)</label>
              <input
                type="number"
                value={capacity || ""}
                onChange={(e) => setCapacity(Number(e.target.value))}
                step="0.5"
                className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">연료</label>
              <select
                value={fuelType}
                onChange={(e) => setFuelType(e.target.value)}
                className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none bg-white"
              >
                <option value="경유">경유</option>
                <option value="휘발유">휘발유</option>
                <option value="LPG">LPG</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">연비 (km/L)</label>
              <input
                type="number"
                value={efficiency || ""}
                onChange={(e) => setEfficiency(Number(e.target.value))}
                step="0.1"
                className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600">비고</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="비고 사항"
              className="h-10 text-sm rounded-lg border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="h-10 bg-[#1F3864] text-white font-semibold rounded-lg text-sm hover:bg-[#162c52] disabled:opacity-50 transition-all"
          >
            {loading ? "등록 중..." : "차량 등록"}
          </button>
        </div>
      )}

      {/* 차량 목록 테이블 */}
      {vehicles.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          등록된 차량이 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500">
                <th className="px-3 py-2.5 text-left font-medium">차량명</th>
                <th className="px-3 py-2.5 text-left font-medium">번호</th>
                <th className="px-3 py-2.5 text-center font-medium">유형</th>
                <th className="px-3 py-2.5 text-right font-medium">적재량</th>
                <th className="px-3 py-2.5 text-right font-medium">연비</th>
                <th className="px-3 py-2.5 text-right font-medium">최종 키로수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2.5 font-medium text-gray-800">{v.vehicle_name}</td>
                  <td className="px-3 py-2.5 text-gray-600">{v.vehicle_number}</td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      {v.vehicle_type}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {v.capacity_ton ? `${v.capacity_ton}톤` : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600">
                    {v.fuel_efficiency} km/L
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#1F3864]">
                    {Number(v.last_mileage).toLocaleString()} km
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
