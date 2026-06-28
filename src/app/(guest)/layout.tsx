import { Building2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-semibold">Apartman Yönetim</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      {children}
    </div>
  );
}
