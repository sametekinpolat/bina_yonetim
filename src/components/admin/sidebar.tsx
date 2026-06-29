"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
  ChevronLeft,
  Menu,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export const navItems = [
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
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex h-screen flex-col border-r bg-sidebar shrink-0 transition-all duration-300",
        isCollapsed ? "w-16" : "w-56"
      )}
    >
      <div className="flex h-14 items-center justify-between border-b px-4">
        {!isCollapsed && (
          <span className="text-sm font-semibold tracking-tight truncate">
            Apartman Yönetim
          </span>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground",
            isCollapsed && "mx-auto"
          )}
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={isCollapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors group",
                isCollapsed ? "justify-center px-0" : "gap-2.5",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-2 space-y-1">
        <div
          className={cn(
            "flex items-center rounded-md px-3 py-2",
            isCollapsed ? "justify-center px-0" : "justify-between"
          )}
        >
          {!isCollapsed && <span className="text-xs text-sidebar-foreground/60">Tema</span>}
          <div className={isCollapsed ? "scale-90" : ""}>
            <ThemeToggle />
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={isCollapsed ? "Çıkış Yap" : undefined}
          className={cn(
            "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
            isCollapsed ? "justify-center px-0" : "gap-2.5"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Çıkış Yap</span>}
        </button>
      </div>
    </aside>
  );
}
