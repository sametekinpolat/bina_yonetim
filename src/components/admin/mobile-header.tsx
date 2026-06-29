"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { navItems } from "./sidebar";

export function MobileHeader() {
  const pathname = usePathname();

  return (
    <header className="flex md:hidden h-14 items-center justify-between border-b px-4 bg-background">
      <span className="text-sm font-semibold tracking-tight">Apartman Yönetim</span>
      <Sheet>
        <SheetTrigger 
          render={<Button variant="ghost" size="icon" className="md:hidden" />}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col p-0 w-72">
          <SheetHeader className="p-4 border-b text-left">
            <SheetTitle className="text-sm font-semibold tracking-tight">Apartman Yönetim</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t p-2 space-y-1">
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
        </SheetContent>
      </Sheet>
    </header>
  );
}
