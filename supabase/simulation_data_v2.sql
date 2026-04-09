-- 새림 ERP 시뮬레이션 데이터 v2
-- schema_v3.sql 실행 후 이 파일을 실행하세요

-- ── 가공팀 업무지시서 샘플 ─────────────────────────────────
INSERT INTO work_orders (order_date, ordered_by, dept, work_hours, workers, items)
VALUES
  ('2026-04-08', '개발이사', '가공팀', '08:30~18:00',
   '쿠이,바르른,라이,김하늘,이수아,이상일,서아원(0.5),신태환',
   '[
     {"product":"소선지","pkg_unit_g":500,"raw_input_kg":0,"target_count":204,"production_count":204,"fat_loss_kg":0},
     {"product":"순도리돈두슬라이스","pkg_unit_g":2000,"raw_input_kg":0,"target_count":290,"production_count":294,"fat_loss_kg":0},
     {"product":"편육","pkg_unit_g":300,"raw_input_kg":0,"target_count":100,"production_count":106,"fat_loss_kg":0}
   ]'::jsonb),
  ('2026-04-09', '개발이사', '가공팀', '08:30~18:00',
   '쿠이,바르른,라이,김하늘,이수아,이상일,서아원,신태환',
   '[
     {"product":"모듬내장","pkg_unit_g":2000,"raw_input_kg":0,"target_count":800,"production_count":0,"fat_loss_kg":0},
     {"product":"국머리혼합","pkg_unit_g":2000,"raw_input_kg":0,"target_count":400,"production_count":0,"fat_loss_kg":0}
   ]'::jsonb)
ON CONFLICT (order_date, dept) DO UPDATE SET items = EXCLUDED.items, workers = EXCLUDED.workers;

-- ── 두/내장 작업일지 샘플 ─────────────────────────────────
INSERT INTO head_work_logs (work_date, manager, head_received, head_items, innard_items, notes)
VALUES
  ('2026-04-08', '공장장', 379,
   '[
     {"name":"귀","unit":"kg","total":120,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":120},
     {"name":"뒷판","unit":"kg","total":0,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":0},
     {"name":"혀","unit":"kg","total":100,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":100},
     {"name":"덜미(X)","unit":"kg","total":63.44,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":63.44,"frozen":0},
     {"name":"관자","unit":"kg","total":29.5,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":29.5},
     {"name":"꽃살","unit":"kg","total":29.82,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":29.82},
     {"name":"릎","unit":"kg","total":363,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":363}
   ]'::jsonb,
   '[
     {"name":"앞판(면도귀X)","unit":"kg","total":250,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":250},
     {"name":"막창","unit":"kg","total":80,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":80},
     {"name":"염통","unit":"kg","total":100,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":100},
     {"name":"오소리","unit":"kg","total":120,"gyusan":0,"road":0,"delivery":0,"jasuk":0,"skin":0,"frozen":120}
   ]'::jsonb,
   '머리 (조나,수닐,바하두루,마임) // 로한발골지원(폐수연장) -18:30 종료 / 내장 (베라,미선) -18:30 종료')
ON CONFLICT (work_date) DO UPDATE SET head_received = EXCLUDED.head_received, head_items = EXCLUDED.head_items;

-- ── 농협 유통 입고 두수 샘플 ─────────────────────────────
INSERT INTO livestock_intake (intake_date, nh_ledger, nh_actual, mokwuchon, recorded_by)
VALUES
  ('2026-03-03', 287, 287, 0, '공장장'),
  ('2026-03-04', 330, 341, 0, '공장장'),
  ('2026-03-05', 319, 308, 0, '공장장'),
  ('2026-03-10', 320, 319, 0, '공장장'),
  ('2026-03-11', 350, 352, 0, '공장장'),
  ('2026-03-17', 240, 240, 0, '공장장'),
  ('2026-03-24', 360, 361, 0, '공장장'),
  ('2026-03-31', 290, 290, 0, '공장장'),
  ('2026-04-07', 310, 312, 0, '공장장'),
  ('2026-04-08', 379, 379, 0, '공장장')
ON CONFLICT (intake_date) DO UPDATE SET nh_ledger = EXCLUDED.nh_ledger, nh_actual = EXCLUDED.nh_actual;

-- ── 수도 사용량 샘플 ─────────────────────────────────────
INSERT INTO water_usage (usage_date, water_reading, ground_water_reading, recorded_by)
VALUES
  ('2026-03-03', 31, 0, '생산팀'),
  ('2026-03-04', 35, 12, '생산팀'),
  ('2026-03-05', 40, 1, '생산팀'),
  ('2026-03-09', 34, 8, '생산팀'),
  ('2026-03-10', 29, 7, '생산팀'),
  ('2026-03-16', 35, 9, '생산팀'),
  ('2026-03-17', 29, 2, '생산팀'),
  ('2026-03-23', 39, 4, '생산팀'),
  ('2026-03-24', 34, 1, '생산팀'),
  ('2026-03-30', 29, 5, '생산팀'),
  ('2026-03-31', 27, 6, '생산팀'),
  ('2026-04-07', 32, 4, '생산팀'),
  ('2026-04-08', 35, 6, '생산팀')
ON CONFLICT (usage_date) DO UPDATE SET water_reading = EXCLUDED.water_reading, ground_water_reading = EXCLUDED.ground_water_reading;

-- ── 품질 순찰일지 샘플 ─────────────────────────────────
INSERT INTO quality_patrol (patrol_date, patrol_time, inspector, dept, areas, issues, overall_status)
VALUES
  ('2026-04-08', '09:00', '품질팀장', '품질팀',
   '["생산라인 A","냉장·냉동창고","가공팀 작업장"]'::jsonb,
   '[{"area":"냉장·냉동창고","description":"냉장창고 문 밀폐 불량 확인","severity":"medium","action":"문 경첩 교체 요청 완료"}]'::jsonb,
   '주의'),
  ('2026-04-07', '09:30', '품질팀장', '품질팀',
   '["생산라인 A","생산라인 B","포장실","탈의실·화장실"]'::jsonb,
   '[]'::jsonb,
   '정상')
;

-- ── 생산계획 샘플 ─────────────────────────────────────────
INSERT INTO production_plans (plan_date, manager, today_plans, next_plans, notes)
VALUES
  ('2026-04-08', '공장장',
   '[
     {"team":"생산팀(두/내장)","product":"돼지머리(두)","target":379,"notes":"농협 입고 기준"},
     {"team":"스킨팀","product":"스킨작업","target":63,"notes":"덜미(X) 분"},
     {"team":"가공팀","product":"소선지","target":204,"notes":"500g 포장"}
   ]'::jsonb,
   '[
     {"team":"생산팀(두/내장)","product":"돼지머리(두)","target":350,"notes":"예상 두수"},
     {"team":"가공팀","product":"모듬내장","target":800,"notes":"2kg 포장"},
     {"team":"가공팀","product":"국머리혼합","target":400,"notes":"2kg 포장"}
   ]'::jsonb,
   '익일 가공팀 모듬내장 물량 증가 예정. 인력 배치 확인 필요')
ON CONFLICT (plan_date) DO UPDATE SET today_plans = EXCLUDED.today_plans, next_plans = EXCLUDED.next_plans;

-- ── 컨테이너 재고 샘플 ──────────────────────────────────
INSERT INTO container_inventory (inventory_date, location, product_name, unit, prev_stock, incoming_qty, outgoing_qty, recorded_by)
VALUES
  ('2026-04-08', '2번냉동실', '귀(냉동)',    'kg', 540, 120, 80, '재고담당'),
  ('2026-04-08', '2번냉동실', '덜미(X)',     'kg', 120, 63.44, 0, '재고담당'),
  ('2026-04-08', '2번냉동실', '관자(냉동)',  'kg', 89, 29.5, 30, '재고담당'),
  ('2026-04-08', '2번냉동실', '꽃살(냉동)',  'kg', 76, 29.82, 50, '재고담당'),
  ('2026-04-08', '3번냉동실', '릎(냉동)',    'kg', 800, 363, 200, '재고담당'),
  ('2026-04-08', '3번냉동실', '앞판(냉동)',  'kg', 600, 250, 150, '재고담당'),
  ('2026-04-08', '3번냉동실', '막창(냉동)',  'kg', 200, 80, 60, '재고담당'),
  ('2026-04-08', '3번냉동실', '염통(냉동)',  'kg', 150, 100, 80, '재고담당'),
  ('2026-04-08', '3번냉동실', '오소리(냉동)','kg', 180, 120, 100, '재고담당'),
  ('2026-04-08', '완제품냉동실', '소선지',   'kg', 300, 204, 180, '재고담당'),
  ('2026-04-08', '완제품냉동실', '편육',     'kg', 150, 106, 80, '재고담당');

-- ── 오딧 체크리스트 샘플 ────────────────────────────────
INSERT INTO audit_checklist (check_date, audit_type, inspector, items, overall_result, next_action)
VALUES
  ('2026-04-07', 'HACCP 자체점검', '품질팀장',
   '[
     {"category":"원료·제품 관리","item":"냉장 보관 온도 0~5°C 유지 확인","result":"적합","notes":""},
     {"category":"원료·제품 관리","item":"냉동 보관 온도 -18°C 이하 확인","result":"적합","notes":""},
     {"category":"원료·제품 관리","item":"원료와 완제품 이격 보관 (15cm 이상)","result":"적합","notes":""},
     {"category":"시설·설비","item":"배수로 막힘 없이 정상 작동","result":"부적합","notes":"3번 냉동실 배수로 이물질 발견"},
     {"category":"시설·설비","item":"냉장·냉동 설비 성애 제거 완료","result":"적합","notes":""},
     {"category":"개인위생","item":"작업자 위생복·위생모 착용","result":"적합","notes":""},
     {"category":"개인위생","item":"작업 전 손 세척 실시 여부 확인","result":"적합","notes":""},
     {"category":"문서·기록","item":"HACCP 모니터링 기록지 최신화","result":"적합","notes":""}
   ]'::jsonb,
   '조건부 적합',
   '3번 냉동실 배수로 청소 완료 후 재점검 (4/10 예정)');

-- ── 부서 보고서 업데이트 (신규 부서 포함) ──────────────────
INSERT INTO dept_reports (report_date, dept, manager_id, manager_name, rag_status, issue, detail, next_action, coo_comment, status)
VALUES
  ('2026-04-07', '가공팀',   'dev',     '개발이사',  'green',  '업무 정상 진행',    '소선지·편육·순도리돈두슬라이스 목표 달성. 로스율 기준치 이내.', '포장재 재고 확인 완료', 'COO 확인: 목표 초과 달성 우수. 익일 모듬내장 물량 증가 대비 인력 배치 점검 바람.', 'reviewed'),
  ('2026-04-07', '스킨팀',   'skin',    '스킨팀장',  'green',  '스킨 작업 정상',    '덜미(X) 63.44kg 스킨작업 완료. 냉동 입고 처리.', '익일 계획 공장장 확인', 'COO 확인: 정상 운영 중.', 'reviewed'),
  ('2026-04-07', '재고팀',   'stock',   '재고담당',  'yellow', '냉동 재고 일부 부족', '꽃살·관자 재고 기준치 하회. 입고 스케줄 확인 필요.', '생산팀 조율하여 입고 일정 협의', 'COO 확인: 재고 부족 품목 생산팀과 조율하여 보충 계획 수립할 것.', 'reviewed')
ON CONFLICT (report_date, dept) DO UPDATE
  SET rag_status = EXCLUDED.rag_status, issue = EXCLUDED.issue, coo_comment = EXCLUDED.coo_comment;
