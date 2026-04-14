import { Header } from "@/components/layout/header";
import { SessionGuard } from "@/components/auth/session-guard";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <SessionGuard />
      <Header />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
