"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Truck,
  Receipt,
  Wallet,
  ArrowLeftRight,
  FileSpreadsheet,
  CreditCard,
  LogOut,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { href: "/periods", label: "Aidat Dönemleri", icon: CalendarDays },
  { href: "/flats", label: "Daireler", icon: Building2 },
  { href: "/residents", label: "Sakinler", icon: Users },
  { href: "/vendors", label: "Firmalar", icon: Truck },
  { href: "/expenses", label: "Giderler", icon: Receipt },
  { href: "/accounts", label: "Hesaplar", icon: Wallet },
  { href: "/transactions", label: "İşlemler", icon: ArrowLeftRight },
  { href: "/bank-import", label: "Banka Aktarımı", icon: FileSpreadsheet },
  { href: "/debts", label: "Borç Takibi", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-sidebar shrink-0">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">Apartman Yönetim</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t p-2 space-y-0.5">
        <div className="flex items-center justify-between rounded-md px-3 py-2">
          <span className="text-xs text-sidebar-foreground/60">Tema</span>
          <ThemeToggle />
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  );
}
