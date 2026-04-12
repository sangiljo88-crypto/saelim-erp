"use client";

import { useState } from "react";

interface DeliveryItem {
  product: string;
  qty_kg: number;
  unit_price: number;
  amount: number;
}

interface Delivery {
  id: string;
  delivery_date: string;
  customer_name: string;
  items: DeliveryItem[] | null;
  total_amount: number;
  status: string;
  driver: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  deliveries: Delivery[];
  totalAmount: number;
  topCustomers: [string, number][];
  initialFrom: string;
  initialTo: string;
  initialCustomer: string;
  initialStatus: string;
  canDelete: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  shipped:   { label: "배송중",    className: "bg-amber-100 text-amber-700" },
  delivered: { label: "배송완료",  className: "bg-emerald-100 text-emerald-700" },
  invoiced:  { label: "청구완료",  className: "bg-blue-100 text-blue-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status];
  if (cfg) {
    return (
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.className}`}>
        {cfg.label}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
      {status || "미지정"}
    </span>
  );
}

function fmtAmount(n: number): string {
  if (n >= 1_0000_0000) {
    return (n / 1_0000_0000).toFixed(2) + "억원";
  }
  if (n >= 1_0000) {
    return (n / 1_0000).toLocaleString(undefined, { maximumFractionDigits: 0 }) + "만원";
  }
  return n.toLocaleString() + "원";
}

function fmtAmountBig(n: number): string {
  // 억원 단위 표시 (소수 둘째 자리)
  return (n / 1_0000_0000).toFixed(2) + "억";
}

export default function DeliveryHistory({
  deliveries,
  totalAmount,
  topCustomers,
  initialFrom,
  initialTo,
  initialCustomer,
  initialStatus,
  canDelete,
}: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [customer, setCustomer] = useState(initialCustomer);
  const [status, setStatus] = useState(initialStatus);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSearch() {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (customer) params.set("customer", customer);
    if (status) params.set("status", status);
    window.location.href = "/deliveries?" + params.toString();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  const count = deliveries.length;
  const avgAmount = count > 0 ? Math.round(totalAmount / count) : 0;

  // 상위 거래처 progress bar 기준값
  const topMax = topCustomers.length > 0 ? topCustomers[0][1] : 1;

  return (
    <div className="flex flex-col gap-5">
      {/* 필터 바 */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">시작일</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              onKeyDown={handleKeyDown}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">종료일</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={handleKeyDown}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">거래처명</label>
            <input
              type="text"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="거래처 검색"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none w-36"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">상태</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1F3864] outline-none bg-white"
            >
              <option value="">전체</option>
              <option value="shipped">배송중</option>
              <option value="delivered">배송완료</option>
              <option value="invoiced">청구완료</option>
            </select>
          </div>
          <button
            onClick={handleSearch}
            className="px-5 py-2 bg-[#1F3864] text-white text-sm font-semibold rounded-lg hover:bg-[#162c52] active:scale-95 transition-all"
          >
            조회
          </button>
        </div>
      </div>

      {/* 요약 카드 3개 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 flex flex-col gap-1">
          <span className="text-xs text-gray-500">납품 건수</span>
          <span className="text-2xl font-bold text-[#1F3864]">{count.toLocaleString()}</span>
          <span className="text-xs text-gray-400">건</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 flex flex-col gap-1">
          <span className="text-xs text-gray-500">총 금액</span>
          <span className="text-2xl font-bold text-[#1F3864]">{fmtAmountBig(totalAmount)}</span>
          <span className="text-xs text-gray-400">{totalAmount.toLocaleString()}원</span>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 flex flex-col gap-1">
          <span className="text-xs text-gray-500">평균 단가</span>
          <span className="text-2xl font-bold text-[#1F3864]">{fmtAmount(avgAmount)}</span>
          <span className="text-xs text-gray-400">건당 평균</span>
        </div>
      </div>

      {/* 상위 거래처 TOP5 */}
      {topCustomers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">거래처 TOP {topCustomers.length}</h2>
          <div className="flex flex-col gap-2.5">
            {topCustomers.map(([name, amount], idx) => {
              const ratio = topMax > 0 ? (amount / totalAmount) * 100 : 0;
              const barWidth = topMax > 0 ? (amount / topMax) * 100 : 0;
              return (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}</span>
                      <span className="text-sm font-medium text-gray-800">{name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{ratio.toFixed(1)}%</span>
                      <span className="text-sm font-semibold text-[#1F3864]">{fmtAmount(amount)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1F3864] rounded-full transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 납품 목록 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-700">납품 전표 목록</h2>
          <span className="text-xs text-gray-400">{count}건</span>
        </div>

        {deliveries.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            조회된 납품 내역이 없습니다.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {deliveries.map((d) => {
              const isExpanded = expandedId === d.id;
              const hasItems = Array.isArray(d.items) && d.items.length > 0;

              return (
                <div key={d.id}>
                  {/* 행 */}
                  <div
                    className="px-4 py-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : d.id)}
                  >
                    {/* 날짜 */}
                    <div className="text-sm text-gray-500 w-24 shrink-0">{d.delivery_date}</div>

                    {/* 거래처 + 드라이버 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">{d.customer_name}</div>
                      {d.driver && (
                        <div className="text-xs text-gray-400 mt-0.5">기사: {d.driver}</div>
                      )}
                    </div>

                    {/* 상태 배지 */}
                    <div className="shrink-0">
                      <StatusBadge status={d.status} />
                    </div>

                    {/* 금액 */}
                    <div className="text-sm font-bold text-[#1F3864] shrink-0 w-24 text-right">
                      {fmtAmount(d.total_amount || 0)}
                    </div>

                    {/* 토글 화살표 */}
                    <div className={`text-gray-300 text-xs shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                      ▼
                    </div>
                  </div>

                  {/* 확장 영역 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                      {/* 품목 테이블 */}
                      {hasItems ? (
                        <div className="mt-3">
                          <div className="grid text-[10px] text-gray-400 font-semibold mb-1.5 px-1"
                            style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr" }}>
                            <span>품목명</span>
                            <span className="text-center">수량(kg)</span>
                            <span className="text-center">단가(원)</span>
                            <span className="text-right">금액(원)</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {(d.items as DeliveryItem[]).map((item, idx) => (
                              <div
                                key={idx}
                                className="grid bg-white rounded-lg px-3 py-2 text-sm border border-gray-100"
                                style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1.2fr" }}
                              >
                                <span className="text-gray-700 font-medium truncate">{item.product}</span>
                                <span className="text-center text-gray-600">{item.qty_kg.toLocaleString()}</span>
                                <span className="text-center text-gray-600">{item.unit_price.toLocaleString()}</span>
                                <span className="text-right font-semibold text-[#1F3864]">
                                  {fmtAmount(item.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="flex justify-between items-center bg-[#1F3864]/5 border border-[#1F3864]/20 rounded-lg px-3 py-2 mt-2">
                            <span className="text-xs font-medium text-gray-600">합계</span>
                            <span className="text-sm font-bold text-[#1F3864]">{fmtAmount(d.total_amount || 0)}</span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-3 px-1">품목 정보 없음</p>
                      )}

                      {/* 비고 */}
                      {d.notes && (
                        <div className="mt-2.5 px-1">
                          <span className="text-xs text-gray-400">비고: </span>
                          <span className="text-xs text-gray-600">{d.notes}</span>
                        </div>
                      )}

                      {/* 삭제 버튼 (canDelete && coo) */}
                      {canDelete && (
                        <div className="mt-3 flex justify-end">
                          <button
                            className="text-xs text-red-400 hover:text-red-600 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("이 납품 전표를 삭제하시겠습니까?")) {
                                // TODO: delete action
                              }
                            }}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
