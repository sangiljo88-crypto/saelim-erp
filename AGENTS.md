<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 새림 ERP — AI 협업 규약

이 저장소는 여러 AI 어시스턴트(Claude Code, Genspark Claw 등)가 함께 작업한다.
**작업 시작 전 반드시 `git pull origin main`, 작업 완료 후 반드시 커밋+푸시.** 미커밋 상태로 방치 금지.

## 프로젝트 개요
- 돼지 부산물 가공·납품 식품제조업체(연매출 180~220억)의 전사 ERP
- 스택: Next.js 16 (Turbopack) + Supabase(서울 리전) + Railway(싱가포르) 자동배포
- 역할: ceo / coo / manager / worker — 세션은 JWT 쿠키 (lib/auth.ts)
- UI 언어는 전부 한국어, 메인 컬러 `#1F3864` (네이비)

## 필수 작업 절차
1. `git pull origin main` 후 시작
2. 코드 수정
3. `npx tsc --noEmit` 통과 확인
4. UI/라우팅 변경 시 `npm run build`까지 통과 확인 (Turbopack 전용 오류는 tsc에 안 잡힘)
5. 한국어 커밋 메시지로 커밋 → `git push origin main` (push가 곧 배포)

## 아키텍처 규칙 (위반 시 빌드 깨짐/회귀 발생)

### 서버 액션
- `app/actions/`는 도메인별 분리: production / inventory / finance / hr / sales / reporting / quality / schedule / leave / dispatch / pricing / expiry / inspection / lot-tracking / procurement / preventive-maintenance / claim-sla / kpi-targets / inventory-audit
- **`app/actions/submit.ts` 사용 금지** — 과거 배럴 재수출 파일. Turbopack이 "use server" 재수출을 지원하지 않아 비워둠. import는 반드시 도메인 파일에서 직접.
- 새 액션 반환 패턴: `{ success: boolean; error?: string }`. 단, 기존 컴포넌트가 try/catch로 받는 액션은 throw 유지 (바꾸면 UI 에러 처리 깨짐).
- 권한 체크 필수: `getSession()` → role/dept 검증. 수정·삭제는 최소 manager 이상.
- 금액/수량 입력은 음수 검증 필수.

### DB (Supabase)
- 스키마 변경은 `supabase/0NN_이름.sql` 번호 체계로 새 파일 추가 (현재 028까지 사용, 시뮬레이션 데이터는 900번대).
- 사용자가 SQL을 Supabase SQL Editor에서 **수동 실행**하므로, 마이그레이션 미실행 상태에서도 코드가 죽지 않게 작성: 새 컬럼/테이블 접근 실패(42703/42P01) 시 구 스키마로 폴백하거나 조용히 건너뛸 것 (app/actions/schedule.ts, leave.ts 패턴 참고).
- Supabase 무료 플랜 — 7일 비활성 시 자동 pause. "TypeError: fetch failed"가 보이면 코드보다 먼저 pause 여부를 의심할 것.

### UI
- 공용 컴포넌트 우선 사용: `components/ui/` (Card, StatCard, SectionHeader, StatusBadge, EmptyState)
- 새 페이지는 `components/NavMenu.tsx`의 그룹 메뉴에 등록 (페이지 안에 퀵링크 중복 생성 금지)
- 상수는 `lib/constants.ts` (DEPT_ORDER, ROLE_LABEL, THRESHOLDS, RAG_*) — 페이지에 하드코딩 금지
- 날짜/시간 입력은 DatePickerInput·TimePickerInput 패턴 (래퍼 div 클릭 시 showPicker() 호출)
- 모바일(현장직원) 화면: 터치 타겟 최소 48px, 숫자 입력엔 +/- 스테퍼, 제출 버튼 하단 고정
- "use server" 파일에서 type-only import 재수출 금지 (런타임 ReferenceError 사고 이력)

### 공통 헬퍼
- 주요 변경(품목/재고/금액)은 `lib/audit.ts` `logAudit()` 호출 — 실패해도 본 작업을 막지 않게 try/catch
- 알림은 `lib/notifications.ts` `sendNotification()` — 동일하게 절대 throw 금지

## 운영 환경
- 배포 URL: https://saelim-erp-production.up.railway.app
- GitHub: https://github.com/sangiljo88-crypto/saelim-erp
- 브리핑 업로드 API: POST /api/briefings/upload (Bearer 키 인증)
- 테스트 계정: ceo/coo = saelim2026, mgr_* = team2026, worker1~8 = 1234 (운영 전환 시 제거 예정)

## 하지 말 것
- `.env.local` 커밋/내용 변경 금지 (키 노출 이력 — 운영 전환 시 재발급 예정)
- 로그인 페이지의 테스트 계정 목록 제거는 사용자 지시 전까지 보류
- 대규모 리팩터링·파일 이동은 사용자와 상의 후 진행 (다른 AI가 동시 작업 중일 수 있음)
