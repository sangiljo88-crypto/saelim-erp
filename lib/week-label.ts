/**
 * 주차 라벨 정규화 유틸
 *
 * 게시판에 혼재하는 주차 라벨 형식을 하나의 표준형으로 통일한다.
 *   - "2026-W23" / "2026W23"      (ISO 주차형)
 *   - "2026년 21주차"              (연도 + ISO 주차 번호형)
 *   - "2026년 6월 2주차"           (표준형 — 월 내 주차, BriefingForm 관례 Math.ceil(day/7))
 *
 * 모든 형식을 ISO 주차(연도+주번호)로 환산한 뒤, 해당 주 월요일 날짜를 기준으로
 * 표준형 라벨("YYYY년 M월 N주차")을 다시 만든다. 같은 주를 가리키는 라벨은
 * 항상 같은 표준 라벨/정렬 키를 얻으므로 그룹 중복·정렬 어긋남이 사라진다.
 *
 * DB 데이터는 건드리지 않고 표시/저장 시점에만 사용한다 (AGENTS.md 합의).
 */

export interface NormalizedWeek {
  /** 표준 표시 라벨 — 예: "2026년 6월 2주차". 해석 불가 시 원본 유지 */
  label: string;
  /** 정렬 키 — 예: "2026-W23" (주 번호 2자리 패딩, 사전순 정렬 가능) */
  sortKey: string;
  /** 라벨을 표준형으로 해석할 수 있었는지 여부 */
  parsed: boolean;
}

const RE_ISO        = /^(\d{4})\s*-?\s*W\s*(\d{1,2})$/i;          // 2026-W23, 2026W23
const RE_YEAR_WEEK  = /^(\d{4})년\s*(\d{1,2})주차$/;               // 2026년 21주차
const RE_MONTH_WEEK = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})주차$/; // 2026년 6월 2주차

/** ISO-8601 주차 계산 (UTC 기준) */
function isoWeekOf(date: Date): { isoYear: number; isoWeek: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;            // 월=1 … 일=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);    // 해당 주의 목요일로 이동
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const isoWeek = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { isoYear, isoWeek };
}

/** 해당 ISO 주차의 월요일 날짜 (UTC) */
function mondayOfISOWeek(isoYear: number, isoWeek: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4)); // 1월 4일은 항상 W01
  const jan4Day = jan4.getUTCDay() || 7;
  const w1Monday = new Date(jan4);
  w1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const monday = new Date(w1Monday);
  monday.setUTCDate(w1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return monday;
}

/** 월요일 날짜 → "YYYY년 M월 N주차" (BriefingForm의 Math.ceil(day/7) 관례와 동일) */
function standardLabel(monday: Date): string {
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const n = Math.ceil(monday.getUTCDate() / 7);
  return `${y}년 ${m}월 ${n}주차`;
}

function fromISO(isoYear: number, isoWeek: number): NormalizedWeek {
  const monday = mondayOfISOWeek(isoYear, isoWeek);
  // 주차 경계(연말연초)에서 isoWeekOf로 재계산해 키 정합성 보장
  const { isoYear: y, isoWeek: w } = isoWeekOf(monday);
  return {
    label: standardLabel(monday),
    sortKey: `${y}-W${String(w).padStart(2, "0")}`,
    parsed: true,
  };
}

/** "YYYY-MM-DD" 문자열을 UTC Date로 안전 파싱 */
function parseDateString(s: string | undefined | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 주차 라벨 정규화.
 *
 * 규칙:
 *  1. 이미 표준형("YYYY년 M월 N주차")이면 **라벨을 그대로 보존**하고 정렬 키만 계산
 *     (기존 게시물의 제목·그룹 라벨이 바뀌어 보이는 부작용 방지).
 *     정렬 키는 publish_date 우선(작성 관례가 게시일 기준이므로 가장 정확),
 *     없으면 라벨에서 대표일을 역산.
 *  2. ISO형("2026-W23")·연주차형("2026년 21주차")은 해당 주 월요일 기준으로
 *     표준형 라벨을 새로 만들어 반환.
 *  3. 해석 불가("테스트" 등)는 라벨 원본 유지, 정렬 키만 publish_date 폴백.
 *
 * @param rawLabel    DB의 week_label 원본 (형식 무관)
 * @param publishDate 게시 날짜 "YYYY-MM-DD"
 */
export function normalizeWeekLabel(rawLabel: string, publishDate?: string | null): NormalizedWeek {
  const label = (rawLabel ?? "").trim();
  const pubDate = parseDateString(publishDate);

  // 1) 표준형 — 라벨 보존, 정렬 키만 산출
  let m = RE_MONTH_WEEK.exec(label);
  if (m) {
    if (pubDate) {
      const { isoYear, isoWeek } = isoWeekOf(pubDate);
      return { label, sortKey: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`, parsed: true };
    }
    // publish_date 없으면 라벨 대표일((N-1)*7+1일)로 역산
    const repDay = (Number(m[3]) - 1) * 7 + 1;
    const rep = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Math.min(repDay, 28)));
    const { isoYear, isoWeek } = isoWeekOf(rep);
    return { label, sortKey: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`, parsed: true };
  }

  // 2) ISO형·연주차형 — 표준형 라벨로 변환
  m = RE_ISO.exec(label);
  if (m) return fromISO(Number(m[1]), Number(m[2]));

  m = RE_YEAR_WEEK.exec(label);
  if (m) return fromISO(Number(m[1]), Number(m[2]));

  // 3) 해석 불가 — 라벨 원본 유지, 정렬 키만 publish_date 폴백
  if (pubDate) {
    const { isoYear, isoWeek } = isoWeekOf(pubDate);
    return { label, sortKey: `${isoYear}-W${String(isoWeek).padStart(2, "0")}`, parsed: false };
  }
  return { label, sortKey: "0000-W00", parsed: false };
}
