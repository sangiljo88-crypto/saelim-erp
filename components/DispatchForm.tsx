"use client";

import { useState, useEffect } from "react";
import { createDispatchLog, completeDispatchLog } from "@/app/actions/dispatch";

interface Vehicle {
  id: string;
  vehicle_name: string;
  vehicle_number: string;
  fuel_type: string;
  last_mileage: number;
}

interface DispatchLog {
  id: string;
  dispatch_date: string;
  vehicle_name: string;
  vehicle_number: string;
  start_mileage: number;
  end_mileage: number | null;
  distance_km: number | null;
  destinations: string | null;
  delivery_count: number;
  start_time: string | null;
  end_time: string | null;
  status: string;
}

interface Props {
  vehicles: Vehicle[];
  myDepartedLogs: DispatchLog[];
}

type Mode = "depart" | "return";

export default function DispatchForm({ vehicles, myDepartedLogs }: Props) {
  const [mode, setMode] = useState<Mode>(myDepartedLogs.length > 0 ? "return" : "depart");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 출발 등록 상태
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [startMileage, setStartMileage] = useState<number>(0);
  const [startTime, setStartTime] = useState(
    new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
  const [destinations, setDestinations] = useState("");
  const [deliveryCount, setDeliveryCount] = useState<number>(0);
  const [dispatchDate, setDispatchDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // 귀환 등록 상태
  const [returnData, setReturnData] = useState<
    Record<string, { end_mileage: number; end_time: string; fuel_filled: number; fuel_cost: number; issues: string }>
  >({});

  // 차량 선택 시 last_mileage 자동 채우기
  useEffect(() => {
    if (selectedVehicle) {
      const v = vehicles.find((v) => v.vehicle_number === selectedVehicle);
      if (v) {
        setStartMileage(Number(v.last_mileage) || 0);
      }
    }
  }, [selectedVehicle, vehicles]);

  function getReturnState(logId: string) {
    return returnData[logId] ?? {
      end_mileage: 0,
      end_time: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      fuel_filled: 0,
      fuel_cost: 0,
      issues: "",
    };
  }

  function updateReturn(logId: string, field: string, value: number | string) {
    setReturnData((prev) => ({
      ...prev,
      [logId]: { ...getReturnState(logId), [field]: value },
    }));
  }

  async function handleDepart() {
    if (!selectedVehicle) {
      setMsg({ type: "err", text: "차량을 선택해주세요." });
      return;
    }
    if (startMileage <= 0) {
      setMsg({ type: "err", text: "출발 키로수를 입력해주세요." });
      return;
    }

    setLoading(true);
    setMsg(null);

    const v = vehicles.find((v) => v.vehicle_number === selectedVehicle);
    const result = await createDispatchLog({
      dispatch_date: dispatchDate,
      vehicle_name: v?.vehicle_name ?? "",
      vehicle_number: selectedVehicle,
      start_mileage: startMileage,
      destinations: destinations || undefined,
      delivery_count: deliveryCount || undefined,
      start_time: startTime || undefined,
      fuel_type: v?.fuel_type || "경유",
    });

    setLoading(false);
    if (result.success) {
      setMsg({ type: "ok", text: "출발 등록 완료!" });
      setSelectedVehicle("");
      setStartMileage(0);
      setDestinations("");
      setDeliveryCount(0);
    } else {
      setMsg({ type: "err", text: result.error ?? "오류가 발생했습니다." });
    }
  }

  async function handleReturn(logId: string) {
    const state = getReturnState(logId);
    if (state.end_mileage <= 0) {
      setMsg({ type: "err", text: "도착 키로수를 입력해주세요." });
      return;
    }

    setLoading(true);
    setMsg(null);

    const result = await completeDispatchLog(logId, {
      end_mileage: state.end_mileage,
      end_time: state.end_time || undefined,
      fuel_filled: state.fuel_filled || undefined,
      fuel_cost: state.fuel_cost || undefined,
      issues: state.issues || undefined,
    });

    setLoading(false);
    if (result.success) {
      setMsg({ type: "ok", text: "귀환 등록 완료!" });
    } else {
      setMsg({ type: "err", text: result.error ?? "오류가 발생했습니다." });
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* 모드 탭 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setMode("depart")}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
            mode === "depart"
              ? "bg-[#1F3864] text-white"
              : "bg-gray-50 text-gray-500 hover:bg-gray-100"
          }`}
        >
          출발 등록
        </button>
        <button
          onClick={() => setMode("return")}
          className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
            mode === "return"
              ? "bg-[#1F3864] text-white"
              : "bg-gray-50 text-gray-500 hover:bg-gray-100"
          }`}
        >
          귀환 등록
          {myDepartedLogs.length > 0 && (
            <span className="absolute top-2 right-4 w-5 h-5 bg-amber-400 text-[10px] font-bold text-white rounded-full flex items-center justify-center">
              {myDepartedLogs.length}
            </span>
          )}
        </button>
      </div>

      {/* 알림 메시지 */}
      {msg && (
        <div
          className={`mx-4 mt-4 px-4 py-3 rounded-xl text-sm font-medium ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ─── 출발 등록 모드 ─── */}
      {mode === "depart" && (
        <div className="p-4 flex flex-col gap-4">
          {/* 날짜 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">날짜</label>
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="h-12 text-base rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none"
            />
          </div>

          {/* 차량 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              차량 선택 <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedVehicle}
              onChange={(e) => setSelectedVehicle(e.target.value)}
              className="h-12 text-base rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none bg-white"
            >
              <option value="">차량을 선택하세요</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.vehicle_number}>
                  {v.vehicle_number} - {v.vehicle_name}
                </option>
              ))}
            </select>
          </div>

          {/* 출발 키로수 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              출발 키로수 (km) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStartMileage((v) => Math.max(0, v - 1))}
                className="w-12 h-12 rounded-xl border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors shrink-0"
              >
                -
              </button>
              <input
                type="number"
                value={startMileage || ""}
                onChange={(e) => setStartMileage(Number(e.target.value))}
                step="0.1"
                placeholder="0"
                className="flex-1 h-12 text-base text-center rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none"
              />
              <button
                type="button"
                onClick={() => setStartMileage((v) => v + 1)}
                className="w-12 h-12 rounded-xl border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors shrink-0"
              >
                +
              </button>
            </div>
            {selectedVehicle && (
              <p className="text-xs text-gray-400">
                최종 기록: {vehicles.find((v) => v.vehicle_number === selectedVehicle)?.last_mileage ?? 0} km
              </p>
            )}
          </div>

          {/* 출발시간 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">출발시간</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="h-12 text-base rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none"
            />
          </div>

          {/* 방문처 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">방문처</label>
            <input
              type="text"
              value={destinations}
              onChange={(e) => setDestinations(e.target.value)}
              placeholder="A마트, B급식업체"
              className="h-12 text-base rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none"
            />
          </div>

          {/* 납품처 수 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">납품처 수</label>
            <input
              type="number"
              value={deliveryCount || ""}
              onChange={(e) => setDeliveryCount(Number(e.target.value))}
              min={0}
              placeholder="0"
              className="h-12 text-base rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none"
            />
          </div>

          {/* 출발 등록 버튼 */}
          <div className="sticky bottom-0 pt-2 pb-1 bg-white">
            <button
              onClick={handleDepart}
              disabled={loading}
              className="w-full h-14 bg-[#1F3864] text-white font-semibold rounded-xl text-base hover:bg-[#162c52] active:scale-[0.98] disabled:opacity-50 transition-all"
            >
              {loading ? "등록 중..." : "출발 등록"}
            </button>
          </div>
        </div>
      )}

      {/* ─── 귀환 등록 모드 ─── */}
      {mode === "return" && (
        <div className="p-4 flex flex-col gap-4">
          {myDepartedLogs.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">
              운행 중인 배차가 없습니다.
            </div>
          ) : (
            myDepartedLogs.map((log) => {
              const state = getReturnState(log.id);
              const previewDistance =
                state.end_mileage > 0
                  ? (state.end_mileage - Number(log.start_mileage)).toFixed(1)
                  : null;

              return (
                <div
                  key={log.id}
                  className="border border-amber-200 bg-amber-50/50 rounded-xl p-4 flex flex-col gap-3"
                >
                  {/* 헤더 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-gray-800">
                        {log.vehicle_number} - {log.vehicle_name}
                      </span>
                      <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                        운행중
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">출발 {log.start_time ?? ""}</span>
                  </div>

                  <div className="text-xs text-gray-500">
                    출발 키로수: <span className="font-semibold text-gray-700">{Number(log.start_mileage).toLocaleString()} km</span>
                    {log.destinations && <span className="ml-2">| {log.destinations}</span>}
                  </div>

                  {/* 도착 키로수 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">
                      도착 키로수 (km) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateReturn(log.id, "end_mileage", Math.max(0, state.end_mileage - 1))}
                        className="w-10 h-12 rounded-xl border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors shrink-0"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={state.end_mileage || ""}
                        onChange={(e) => updateReturn(log.id, "end_mileage", Number(e.target.value))}
                        step="0.1"
                        placeholder="0"
                        className="flex-1 h-12 text-base text-center rounded-xl border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateReturn(log.id, "end_mileage", state.end_mileage + 1)}
                        className="w-10 h-12 rounded-xl border border-gray-300 text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors shrink-0"
                      >
                        +
                      </button>
                    </div>
                    {previewDistance && Number(previewDistance) > 0 && (
                      <p className="text-xs text-[#1F3864] font-semibold">
                        주행거리: {Number(previewDistance).toLocaleString()} km
                      </p>
                    )}
                  </div>

                  {/* 도착시간 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">도착시간</label>
                    <input
                      type="time"
                      value={state.end_time}
                      onChange={(e) => updateReturn(log.id, "end_time", e.target.value)}
                      className="h-12 text-base rounded-xl border border-gray-300 px-4 focus:border-[#1F3864] outline-none"
                    />
                  </div>

                  {/* 주유 정보 (같은 줄에 2개) */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">주유량 (L)</label>
                      <input
                        type="number"
                        value={state.fuel_filled || ""}
                        onChange={(e) => updateReturn(log.id, "fuel_filled", Number(e.target.value))}
                        step="0.1"
                        placeholder="주유 시 입력"
                        className="h-12 text-base rounded-xl border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-gray-600">주유비 (원)</label>
                      <input
                        type="number"
                        value={state.fuel_cost || ""}
                        onChange={(e) => updateReturn(log.id, "fuel_cost", Number(e.target.value))}
                        step="100"
                        placeholder="주유 시 입력"
                        className="h-12 text-base rounded-xl border border-gray-300 px-3 focus:border-[#1F3864] outline-none"
                      />
                    </div>
                  </div>

                  {/* 특이사항 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-gray-600">차량 이상/특이사항</label>
                    <textarea
                      value={state.issues}
                      onChange={(e) => updateReturn(log.id, "issues", e.target.value)}
                      rows={2}
                      placeholder="이상 없으면 비워두세요"
                      className="text-base rounded-xl border border-gray-300 px-4 py-3 focus:border-[#1F3864] outline-none resize-none"
                    />
                  </div>

                  {/* 귀환 등록 버튼 */}
                  <button
                    onClick={() => handleReturn(log.id)}
                    disabled={loading}
                    className="w-full h-14 bg-green-600 text-white font-semibold rounded-xl text-base hover:bg-green-700 active:scale-[0.98] disabled:opacity-50 transition-all"
                  >
                    {loading ? "등록 중..." : "귀환 등록"}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
