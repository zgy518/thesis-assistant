import { Routes, Route } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import Layout from "@/components/layout/Layout";
import DashboardPage from "@/pages/DashboardPage";
import SettingsPage from "@/pages/SettingsPage";
import TopicOutlinePage from "@/pages/TopicOutlinePage";
import WritingPage from "@/pages/WritingPage";
import ReferencesPage from "@/pages/ReferencesPage";
import TermsPage from "@/pages/TermsPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/paper/:paperId/topic" element={<TopicOutlinePage />} />
          <Route path="/paper/:paperId/write" element={<WritingPage />} />
          <Route path="/paper/:paperId/references" element={<ReferencesPage />} />
          <Route path="/paper/:paperId/terms" element={<TermsPage />} />
          <Route
            path="*"
            element={
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <p className="text-lg font-medium">404</p>
                <p>页面未找到</p>
              </div>
            }
          />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
