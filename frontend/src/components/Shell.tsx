import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Building2, BarChart3, Settings, LogOut, Search, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/CommandPalette";
import { GridBackground } from "@/components/aceternity/backgrounds";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { initials } from "@/lib/utils";

const NAV = [
  { to: "/distributors", label: "Distributors", icon: Building2 },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3 },
];

export function Shell() {
  const { session, logout } = useAuth();
  const [cmdOpen, setCmdOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link to="/distributors">
                  <div className="relative flex aspect-square size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-[0_0_24px_-4px_hsl(var(--primary))]">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 leading-none">
                    <span className="font-semibold text-gradient-primary animate-shimmer">AI Intelligence</span>
                    <span className="text-xs text-muted-foreground">Distributor research</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => setCmdOpen(true)} className="text-muted-foreground" tooltip="Command palette (⌘K)">
                    <Search /><span>Search…</span>
                    <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Workspace</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV.map((n) => (
                  <SidebarMenuItem key={n.to}>
                    <NavLink to={n.to}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} tooltip={n.label}>
                          <n.icon /><span>{n.label}</span>
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg">
                    <Avatar className="h-8 w-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-primary/15 text-primary font-medium">{initials(session?.name)}</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">{session?.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{session?.isAdmin ? "Admin" : "Sales"}</span>
                    </div>
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="end" className="min-w-56">
                  <DropdownMenuLabel>@{session?.username}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate("/settings")}>
                    <Settings className="mr-2 h-4 w-4" /> Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={async () => { await logout(); navigate("/login"); }} className="text-rose-400 focus:text-rose-400">
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="relative min-w-0">
        <GridBackground className="opacity-30 pointer-events-none" />
        <div className="absolute right-3 top-3 z-30">
          <ThemeSwitcher />
        </div>
        {/* min-w-0 + overflow-x-clip prevents wide kanban from spilling past the sidebar
            without creating an internal scroll context (overflow-x-hidden would make
            `<main>` a scroll container for both axes via spec quirk, breaking
            position:sticky for pages that scroll the document instead of main). */}
        <div className="relative z-10 p-4 md:p-6 min-w-0 overflow-x-clip"><Outlet /></div>
      </SidebarInset>
      <CommandPalette open={cmdOpen} onOpenChange={setCmdOpen} />
    </SidebarProvider>
  );
}
