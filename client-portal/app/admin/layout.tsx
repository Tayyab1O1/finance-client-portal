import AdminProtectedRoute from "@/components/AdminProtectedRoute";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminProtectedRoute>{children}</AdminProtectedRoute>;
}
