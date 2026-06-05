import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth-context";
import { LoginPage } from "./pages/LoginPage";
import { Shell } from "./components/Shell";
import { DistributorsPage } from "./pages/DistributorsPage";
import { DistributorDetailPage } from "./pages/DistributorDetailPage";
import { ContactDossierPage } from "./pages/ContactDossierPage";
import { PersonDossierPage } from "./pages/PersonDossierPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const { session, loading } = useAuth();
  if (loading) return <div className="grid place-items-center min-h-screen text-muted-foreground">Loading…</div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/distributors" replace /> : <LoginPage />} />
      <Route element={session ? <Shell /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Navigate to="/distributors" replace />} />
        <Route path="/distributors" element={<DistributorsPage />} />
        <Route path="/distributors/:id" element={<DistributorDetailPage />} />
        <Route path="/distributors/:id/contacts/:contactId" element={<ContactDossierPage />} />
        <Route path="/distributors/:id/people/:personId" element={<PersonDossierPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<div className="grid place-items-center min-h-screen text-muted-foreground">Not found · <a className="text-primary underline ml-2" href="/distributors">Home</a></div>} />
    </Routes>
  );
}
