import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/auth";

const PUBLIC_ROUTES = ["/login", "/signup"];
const ROLE_ROUTES: Record<string, string[]> = {
  "/dashboard": ["ceo"],
  "/coo":       ["coo"],
  "/team":      ["manager"],
  "/worker":    ["worker"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 퍼블릭 라우트는 통과
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("session")?.value;
  const session = token ? await decrypt(token) : null;

  // 미로그인 → 로그인 페이지
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 권한 없는 라우트 접근 → 본인 홈으로
  for (const [route, roles] of Object.entries(ROLE_ROUTES)) {
    if (pathname.startsWith(route) && !roles.includes(session.role)) {
      const roleHome: Record<string, string> = {
        ceo: "/dashboard", coo: "/coo", manager: "/team", worker: "/worker",
      };
      return NextResponse.redirect(new URL(roleHome[session.role] ?? "/login", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
