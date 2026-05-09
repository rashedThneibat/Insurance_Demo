import { useEffect, useRef, useState } from "react";
import { ChevronDown, Moon, Sun, UserCheck, UserCog } from "lucide-react";
import { NavLink, Outlet, Route, Routes } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/useTheme";
import { roleDisplayName, roleInitials, roleLabel, useRole } from "@/lib/roleStore";
import QueuePage from "@/pages/QueuePage";
import ClaimWorkspacePage from "@/pages/ClaimWorkspacePage";
import SettingsPage from "@/pages/SettingsPage";

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `text-sm font-medium px-3 py-1.5 rounded-md transition-colors ${
          isActive
            ? "bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        }`
      }
    >
      {children}
    </NavLink>
  );
}

function RoleSwitcher() {
  const [role, setRoleState] = useRole();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 px-2 py-1 transition-colors"
        aria-label="Switch role"
        aria-expanded={open}
      >
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold select-none text-white ${
            role === "adjuster" ? "bg-slate-700" : "bg-emerald-700"
          }`}
        >
          {roleInitials(role)}
        </div>
        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">
            {roleDisplayName(role)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">
            {roleLabel(role)}
          </span>
        </div>
        <ChevronDown className={`size-3.5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg z-40 overflow-hidden">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
            Switch role (demo)
          </div>
          <button
            onClick={() => { setRoleState("adjuster"); setOpen(false); }}
            className={`w-full text-left flex items-start gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
              role === "adjuster" ? "bg-slate-50 dark:bg-slate-800" : ""
            }`}
          >
            <UserCog className="size-4 text-slate-500 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm text-slate-800 dark:text-slate-200">Adjuster</span>
              <span className="text-[10px] text-slate-400">Triage, AI analysis, draft outbound</span>
            </div>
          </button>
          <button
            onClick={() => { setRoleState("senior_approver"); setOpen(false); }}
            className={`w-full text-left flex items-start gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${
              role === "senior_approver" ? "bg-slate-50 dark:bg-slate-800" : ""
            }`}
          >
            <UserCheck className="size-4 text-emerald-600 mt-0.5 shrink-0" />
            <div className="flex flex-col">
              <span className="text-sm text-slate-800 dark:text-slate-200">Senior Approver</span>
              <span className="text-[10px] text-slate-400">Read-only review, approve / reject</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { theme, toggle } = useTheme();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-slate-900 dark:text-slate-100 font-bold text-lg tracking-tight">
              ClaimsCopilot
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-widest bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded px-1.5 py-0.5 leading-none">
              DEMO
            </span>
          </div>

          <nav className="flex items-center gap-1">
            <NavItem to="/">Queue</NavItem>
            <NavItem to="/settings">Settings</NavItem>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <RoleSwitcher />
          </div>
        </div>
      </header>

      <main className="max-w-[88rem] mx-auto px-4 sm:px-6 lg:px-8">
        <Routes>
          <Route path="/" element={<QueuePage />} />
          <Route path="/claim/:id" element={<ClaimWorkspacePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
        <Outlet />
      </main>
    </div>
  );
}
