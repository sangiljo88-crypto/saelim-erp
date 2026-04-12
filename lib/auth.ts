import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type Role = "ceo" | "coo" | "manager" | "worker";

export interface User {
  id: string;
  password: string;
  name: string;
  role: Role;
  dept?: string;
}

export interface SessionPayload {
  id: string;
  name: string;
  role: Role;
  dept?: string;
}

// 목업 사용자 목록 (DB 연동 전까지 사용)
export const MOCK_USERS: User[] = [
  // 경영진
  { id: "ceo",      password: "saelim2026", name: "대표이사",   role: "ceo" },
  { id: "coo",      password: "saelim2026", name: "COO",        role: "coo" },
  // 팀장 / 관리자
  { id: "factory",  password: "team2026",   name: "공장장",     role: "manager", dept: "생산팀" },
  { id: "dev",      password: "team2026",   name: "개발이사",   role: "manager", dept: "개발팀" },
  { id: "quality",  password: "team2026",   name: "품질팀장",   role: "manager", dept: "품질팀" },
  { id: "stock",    password: "team2026",   name: "재고담당",   role: "manager", dept: "재고팀" },
  { id: "process",  password: "team2026",   name: "가공팀장",   role: "manager", dept: "가공팀" },
  { id: "skin",     password: "team2026",   name: "스킨팀장",   role: "manager", dept: "스킨팀" },
  { id: "marketing",password: "team2026",   name: "마케팅팀장", role: "manager", dept: "마케팅팀" },
  { id: "account",  password: "team2026",   name: "회계팀장",   role: "manager", dept: "회계팀" },
  { id: "delivery", password: "team2026",   name: "배송팀장",   role: "manager", dept: "배송팀" },
  { id: "cs",       password: "team2026",   name: "CS팀장",     role: "manager", dept: "CS팀" },
  { id: "online",   password: "team2026",   name: "온라인팀장", role: "manager", dept: "온라인팀" },
  // 작업자
  // ── 하위호환 (기존 테스트 계정) ──────────────────────────
  { id: "worker1",  password: "1234",     name: "김현수 (생산)", role: "worker",  dept: "생산팀" },
  { id: "worker2",  password: "1234",     name: "이민준 (품질)", role: "worker",  dept: "품질팀" },
  { id: "prod",     password: "team2026", name: "생산팀장",      role: "manager", dept: "생산팀" },
  // ── 신규 계정 ─────────────────────────────────────────────
  { id: "w_prod1",  password: "1234", name: "김현수",   role: "worker", dept: "생산팀" },
  { id: "w_prod2",  password: "1234", name: "이민준",   role: "worker", dept: "생산팀" },
  { id: "w_proc1",  password: "1234", name: "박서연",   role: "worker", dept: "가공팀" },
  { id: "w_proc2",  password: "1234", name: "최태양",   role: "worker", dept: "가공팀" },
  { id: "w_skin1",  password: "1234", name: "정하늘",   role: "worker", dept: "스킨팀" },
  { id: "w_qual1",  password: "1234", name: "한지수",   role: "worker", dept: "품질팀" },
  { id: "w_del1",   password: "1234", name: "오성민",   role: "worker", dept: "배송팀" },
  { id: "w_cs1",    password: "1234", name: "윤미래",   role: "worker", dept: "CS팀" },
];

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "saelim-erp-secret-key-change-in-production"
);

export async function encrypt(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(SECRET);
}

export async function decrypt(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return decrypt(token);
}

/** COO/CEO 열람 현황에서 사용할 실제 직원 목록 (레거시 테스트 계정 제외) */
export const STAFF_USERS = MOCK_USERS.filter(
  (u) => !["ceo", "coo", "worker1", "worker2", "prod"].includes(u.id)
).map((u) => ({ id: u.id, name: u.name, dept: u.dept }));

export function roleHomePath(role: Role): string {
  const map: Record<Role, string> = {
    ceo: "/dashboard",
    coo: "/coo",
    manager: "/team",
    worker: "/worker",
  };
  return map[role];
}
