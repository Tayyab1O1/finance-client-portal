import AdminProtectedRoute from "@/components/AdminProtectedRoute";
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminProtectedRoute>{children}</AdminProtectedRoute>;
}
