-- ============================================================================
-- 905_fix_briefing_labels.sql
-- 브리핑 주차 라벨 보정 — publish_date의 ISO 주차를 진실(source of truth)로 간주
--
-- 배경:
--   4월 게시물들의 week_label이 게시일의 ISO 주차와 한 주씩 어긋나게 입력되어
--   주차 라벨 정규화(lib/week-label.ts, 커밋 5ebc88f) 이후 같은 표시 라벨이
--   두 그룹으로 나타나는 문제가 확인됨 ("2026년 4월 4주차" 중복).
--
-- 보정 기준:
--   표준 라벨 = 해당 ISO 주차 월요일 날짜의 "YYYY년 M월 N주차" (N = ceil(일/7))
--   → lib/week-label.ts standardLabel()과 동일한 관례
--
-- ⚠️ 승인받은 12건(4/20 그룹)만 보정하면 기존 4/13 그룹("2026년 4월 3주차")과
--    표시 라벨이 다시 충돌하므로, 같은 기준으로 연쇄 보정이 필요한
--    4/12·4/13 그룹까지 포함해 총 36건을 보정한다. (섹션별로 분리)
--
-- 보정 전 → 후 매핑:
-- ┌────────────┬──────────┬──────────────────┬──────────────────┬──────┐
-- │ publish_date │ ISO 주차 │ 보정 전 라벨        │ 보정 후 라벨        │ 건수 │
-- ├────────────┼──────────┼──────────────────┼──────────────────┼──────┤
-- │ 2026-04-12 │ 2026-W15 │ 2026년 4월 2주차   │ 2026년 4월 1주차   │ 12건 │
-- │ 2026-04-13 │ 2026-W16 │ 2026년 4월 3주차   │ 2026년 4월 2주차   │ 12건 │
-- │ 2026-04-20 │ 2026-W17 │ 2026년 4월 4주차   │ 2026년 4월 3주차   │ 12건 │
-- └────────────┴──────────┴──────────────────┴──────────────────┴──────┘
--   * 4/27 그룹("2026년 18주차"/"2026-W18")은 ISO W18과 일치 → 보정 불필요
--     (표시 시점에 "2026년 4월 4주차"로 정규화되어 자연스럽게 자리를 채움)
--   * "테스트" 라벨(DB 연결 테스트, 2026-05-12) 1건은 운영 데이터가 아니므로 제외
--
-- 실행: Supabase SQL Editor에서 전체 실행 (idempotent — 재실행해도 안전)
-- ============================================================================

-- ── 섹션 1. 2026-04-20 게시물 (승인분 12건): 4월 4주차 → 4월 3주차 ──────────
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = '01b03b46-3a41-44d0-b936-d1ffb7b97309'; -- 재고팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = '2f3390ef-d245-453c-a56e-817688d85fc5'; -- 회계팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = '52af9321-25c3-424d-a22f-2cb0df3e6496'; -- 온라인팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = '714e1f8a-5d6b-4554-9935-edc805a941b5'; -- 개발팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = '7d291c8f-0950-4776-a86b-7049f27e85f5'; -- 업계동향
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = '96b8fa05-70ce-475d-ae88-a50ba0d793a4'; -- 배송팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = 'a6f125c8-aecf-4149-b9a3-d18cd3993bd9'; -- 마케팅팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = 'cfa2c5e9-daba-4215-b245-6b29384ef590'; -- 품질팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = 'd3c4ba34-0c11-4a2c-9a42-30102e25a8c2'; -- 생산팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = 'e4ea5c97-74d0-4c9b-9a8e-1bd678b2be64'; -- 가공팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = 'eb7cf70f-9b19-4d4d-8e0f-77885581273e'; -- 스킨팀
UPDATE briefings SET week_label = '2026년 4월 3주차' WHERE id = 'fd051a27-f494-4b95-81ac-53c84bbc9cb4'; -- CS팀

-- ── 섹션 2. 2026-04-13 게시물 (연쇄 보정 12건): 4월 3주차 → 4월 2주차 ────────
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '09468097-1df0-47a8-8235-5d20909b3602'; -- 온라인팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '185594f5-3765-49d7-83b2-ed42901d2c38'; -- 개발팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '19d256c3-1509-4d85-9155-81a89bed4d0a'; -- CS팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '3a595e88-c412-43c2-ae05-46fe39bc8baa'; -- 가공팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '56be7d67-b5ee-4404-8e2a-b770116f221a'; -- 품질팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '62ad3bf2-9eff-4fd7-9def-ab364ec8a34b'; -- 업계동향
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = '7a8a335b-2e13-4fbd-8399-48261b305e5e'; -- 회계팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = 'b911cc01-8a96-4cc8-9099-a99bdeb2adc7'; -- 마케팅팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = 'd8f7a046-043b-4427-ba23-4dc8bca119be'; -- 재고팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = 'd9003583-4660-4fa3-b65d-87196339d854'; -- 생산팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = 'e0051d52-a5ba-4c6d-b4de-5cc0bd4821b9'; -- 배송팀
UPDATE briefings SET week_label = '2026년 4월 2주차' WHERE id = 'feb27881-a6ab-46a2-a88f-599d0243a737'; -- 스킨팀

-- ── 섹션 3. 2026-04-12 게시물 (연쇄 보정 12건): 4월 2주차 → 4월 1주차 ────────
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = '08651ebb-0faf-4dbd-b299-a14def256da3'; -- 개발팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = '09a0202d-987f-43e4-9fbe-2583159ae636'; -- 가공팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = '3126d710-9e51-4e75-aa7b-8249d9dfe40c'; -- 업계동향
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = '4b407e15-5cbb-4390-b574-18c99e57fd46'; -- 생산팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = '5325b30c-6fee-4108-b2a8-101f9b0cbc2e'; -- 마케팅팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = '75228e25-ac77-4ed0-90e8-123151ff8b15'; -- 배송팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = 'a24db924-cf27-4558-aa72-03479cddd03a'; -- 온라인팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = 'b477b445-3e2e-4c42-b750-5837670c05dd'; -- 회계팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = 'b85bacf8-e034-4709-b5f4-951d02cc7200'; -- CS팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = 'c641dc99-6d4a-4b7a-b4da-c3f9dd57f111'; -- 품질팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = 'c983601e-bd84-435b-877f-33ad55add64d'; -- 재고팀
UPDATE briefings SET week_label = '2026년 4월 1주차' WHERE id = 'f16706bd-332d-424d-ab33-df00ea771f56'; -- 스킨팀

-- ── 검증 쿼리 (실행 후 확인용) ────────────────────────────────────────────────
-- SELECT publish_date, week_label, count(*)
--   FROM briefings
--  WHERE publish_date IN ('2026-04-12','2026-04-13','2026-04-20')
--  GROUP BY publish_date, week_label
--  ORDER BY publish_date;
-- 기대 결과: 04-12 → '2026년 4월 1주차' 12건 / 04-13 → '2026년 4월 2주차' 12건
--           / 04-20 → '2026년 4월 3주차' 12건
