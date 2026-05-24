import { Link, useLocation, Outlet } from "react-router-dom";
import { Settings, BookOpen, FileText, Moon, Sun } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";

export default function Layout() {
  const location = useLocation();
  const { settings, saveSettings } = useSettings();

  return (
    <div className={`flex min-h-screen flex-col ${settings.theme === "dark" ? "dark" : ""}`}>
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <BookOpen className="h-5 w-5" />
            Thesis Assistant
          </Link>

          <nav className="flex items-center gap-1">
            <Link to="/" className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${location.pathname === "/" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              <FileText className="h-4 w-4" />论文
            </Link>
            <Link to="/settings" className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm ${location.pathname === "/settings" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
              <Settings className="h-4 w-4" />设置
            </Link>
            <button
              type="button"
              className="ml-2 rounded-md p-1.5 hover:bg-accent"
              onClick={() => saveSettings({ theme: settings.theme === "dark" ? "light" : "dark" })}
            >
              {settings.theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-6xl p-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
