"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Building2,
  Search,
  Megaphone,
  BarChart3,
  Upload,
  Plug,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Scraper", href: "/scraper", icon: Search },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Upload", href: "/upload", icon: Upload },
  { label: "Integrations", href: "/integrations", icon: Plug },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/novalead-icon.svg" alt="NovaLead" width={28} height={28} />
          <span className="font-[var(--font-display)] text-lg">
            <span className="font-extrabold text-foreground">Nova</span>
            <span className="font-normal text-muted-foreground">Lead</span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-primary border-l-2 border-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
