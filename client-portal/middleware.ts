import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Redirect completely unauthenticated users away from protected routes.
// Role enforcement (admin vs client) is handled by AdminProtectedRoute/ProtectedRoute
// client-side, backed by Firestore security rules server-side.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = request.cookies.has("auth_present");

  if (!isAuthenticated) {
    if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*"],
};
