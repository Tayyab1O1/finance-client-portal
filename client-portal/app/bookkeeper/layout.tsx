import BookkeeperProtectedRoute from "@/components/BookkeeperProtectedRoute";

export default function BookkeeperLayout({ children }: { children: React.ReactNode }) {
  return <BookkeeperProtectedRoute>{children}</BookkeeperProtectedRoute>;
}
