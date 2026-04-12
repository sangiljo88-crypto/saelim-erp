// FIFO 원가 계산 라이브러리
// 가장 먼저 매입한 배치부터 소진하여 원가를 계산

export interface PurchaseBatch {
  id: string;
  purchase_date: string;
  created_at?: string;   // 동일 날짜 시 tiebreaker
  material_name: string;
  unit_price: number;
  quantity: number;
  remaining_qty: number;
}

export interface FifoResult {
  totalCost: number;       // 총 FIFO 원가
  avgUnitPrice: number;    // 평균 단가
  batchDetails: Array<{
    purchase_date: string;
    created_at?: string;   // 등록 시각 (시간 표시용)
    unit_price: number;
    consumed: number;      // 해당 배치에서 소비한 수량
    cost: number;          // 해당 배치 원가
  }>;
  unallocated: number;     // 매입 기록 없어서 미배분된 수량
}

/**
 * FIFO 원가 계산
 * @param batches - 날짜순 정렬된 매입 배치 목록 (오래된 것 먼저)
 * @param consumedQty - 소비 수량
 * @returns FifoResult
 */
export function calculateFifo(
  batches: PurchaseBatch[],
  consumedQty: number
): FifoResult {
  let remaining = consumedQty;
  let totalCost = 0;
  const batchDetails: FifoResult["batchDetails"] = [];

  // 날짜 오름차순 정렬 (가장 오래된 것 먼저, 동일 날짜면 등록순)
  const sorted = [...batches].sort((a, b) => {
    const dateComp = a.purchase_date.localeCompare(b.purchase_date);
    if (dateComp !== 0) return dateComp;
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  for (const batch of sorted) {
    if (remaining <= 0) break;
    if (batch.remaining_qty <= 0) continue;

    const consumed = Math.min(remaining, batch.remaining_qty);
    const cost = Math.round(consumed * batch.unit_price);
    totalCost += cost;
    remaining -= consumed;

    batchDetails.push({
      purchase_date: batch.purchase_date,
      created_at:    batch.created_at,
      unit_price:    batch.unit_price,
      consumed,
      cost,
    });
  }

  const allocated = consumedQty - remaining;
  const avgUnitPrice = allocated > 0 ? Math.round(totalCost / allocated) : 0;

  return {
    totalCost,
    avgUnitPrice,
    batchDetails,
    unallocated: remaining,
  };
}

/**
 * 월별 가중평균단가 계산 (단순 평균)
 */
export function calculateWeightedAvg(batches: PurchaseBatch[]): number {
  const totalQty  = batches.reduce((s, b) => s + b.quantity, 0);
  const totalCost = batches.reduce((s, b) => s + b.quantity * b.unit_price, 0);
  return totalQty > 0 ? Math.round(totalCost / totalQty) : 0;
}

/**
 * 원 단위를 만원으로 변환 (소수점 1자리)
 */
export function toMan(won: number): string {
  return (won / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

/**
 * 원 단위를 억원으로 변환 (소수점 2자리)
 */
export function toEok(won: number): string {
  return (won / 100_000_000).toFixed(2);
}
