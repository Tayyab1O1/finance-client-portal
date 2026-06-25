import AdminProtectedRoute from "@/components/AdminProtectedRoute";
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AdminProtectedRoute>{children}</AdminProtectedRoute>;
}
