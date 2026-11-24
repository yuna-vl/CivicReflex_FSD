import React,{lazy,Suspense} from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { AuthProvider } from './context/AuthContext';
import { ReportsProvider } from './context/ReportsContext';

// Common Components & Route Guard
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/common/ProtectedRoute';

// Public & Citizen Pages
import HomePage from './pages/Home/HomePage';
import AboutPage from './pages/About/AboutPage';
import CitizenServicesPage from './pages/Citizen/CitizenServicesPage';
import CitizenDashboardPage from './pages/Citizen/CitizenDashboardPage';
import ReportIssuePage from './pages/Reports/ReportIssuePage';
import BlindSpotsPage from './pages/BlindSpots/BlindSpotsPage';
import TrackComplaintPage from './pages/Tracking/TrackComplaintPage';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import LoginPage from './pages/Auth/LoginPage';

// Authority Portal Layout & Pages
import AuthorityLayout from './components/layout/AuthorityLayout';


// Field Officer Portal Layout & Pages
import OfficerLayout from './components/layout/OfficerLayout';

// Milestone 4: System Administrator Portal Layout & Pages
import AdminLayout from './components/layout/AdminLayout';
// Lazy-loaded portal pages
const AuthorityDashboardPage = lazy(() => import('./pages/Authority/AuthorityDashboardPage').then((m) => ({ default: m.AuthorityDashboardPage })));
const AuthorityGrievancesPage = lazy(() => import('./pages/Authority/AuthorityGrievancesPage').then((m) => ({ default: m.AuthorityGrievancesPage })));
const AuthorityAssignmentsPage = lazy(() => import('./pages/Authority/AuthorityAssignmentsPage').then((m) => ({ default: m.AuthorityAssignmentsPage })));
const AuthorityBlindSpotsPage = lazy(() => import('./pages/Authority/AuthorityBlindSpotsPage').then((m) => ({ default: m.AuthorityBlindSpotsPage })));
const AuthorityAnalyticsPage = lazy(() => import('./pages/Authority/AuthorityAnalyticsPage').then((m) => ({ default: m.AuthorityAnalyticsPage })));
const AuthorityProfilePage = lazy(() => import('./pages/Authority/AuthorityProfilePage').then((m) => ({ default: m.AuthorityProfilePage })));
const OfficerDashboardPage = lazy(() => import('./pages/Officer/OfficerDashboardPage').then((m) => ({ default: m.OfficerDashboardPage })));
const OfficerAssignedWorkPage = lazy(() => import('./pages/Officer/OfficerAssignedWorkPage').then((m) => ({ default: m.OfficerAssignedWorkPage })));
const OfficerInspectionsPage = lazy(() => import('./pages/Officer/OfficerInspectionsPage').then((m) => ({ default: m.OfficerInspectionsPage })));
const OfficerProfilePage = lazy(() => import('./pages/Officer/OfficerProfilePage').then((m) => ({ default: m.OfficerProfilePage })));
const AdminDashboardPage = lazy(() => import('./pages/Admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('./pages/Admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminModerationPage = lazy(() => import('./pages/Admin/AdminModerationPage').then((m) => ({ default: m.AdminModerationPage })));
const AdminWardsPage = lazy(() => import('./pages/Admin/AdminWardsPage').then((m) => ({ default: m.AdminWardsPage })));
const AdminDepartmentsPage = lazy(() => import('./pages/Admin/AdminDepartmentsPage').then((m) => ({ default: m.AdminDepartmentsPage })));
const AdminCategoriesPage = lazy(() => import('./pages/Admin/AdminCategoriesPage').then((m) => ({ default: m.AdminCategoriesPage })));
const AdminAuditLogsPage = lazy(() => import('./pages/Admin/AdminAuditLogsPage').then((m) => ({ default: m.AdminAuditLogsPage })));
const AdminSettingsPage = lazy(() => import('./pages/Admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));
const AdminProfilePage = lazy(() => import('./pages/Admin/AdminProfilePage').then((m) => ({ default: m.AdminProfilePage })));

// Global & Component Styles
import './styles/variables.css';
import './styles/global.css';
import './styles/components.css';

// 404 Institutional Fallback Component
const NotFoundPage = () => (
  <div className="portal-container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', color: 'var(--color-primary-navy)', fontWeight: 700 }}>
      404
    </div>
    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--color-primary-navy)', margin: '0.5rem 0 1rem 0' }}>
      Public Page / Circular Not Found
    </h2>
    <p style={{ color: 'var(--color-text-secondary)', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
      The requested civic portal link may have been relocated, archived, or is currently under scheduled maintenance.
    </p>
    <a href="/" className="btn btn-primary">
      Return to Portal Homepage
    </a>
  </div>
);

export function App() {
  return (
    <AccessibilityProvider>
      <AuthProvider>
        <ReportsProvider>
          <BrowserRouter>
          <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
            <Routes>
              {/* Public & Citizen Portal Routes */}
              <Route path="/" element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="about" element={<AboutPage />} />
                <Route path="services" element={<CitizenServicesPage />} />
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <CitizenDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="my-complaints"
                  element={
                    <ProtectedRoute allowedRoles={['citizen']}>
                      <CitizenDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="report" element={<ReportIssuePage />} />
                <Route path="blind-spots" element={<BlindSpotsPage />} />
                <Route path="track" element={<TrackComplaintPage />} />
                <Route path="notifications" element={<NotificationsPage />} />
                <Route path="login" element={<LoginPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              {/* Authority Administration Portal Routes */}
              <Route
                path="authority"
                element={
                  <ProtectedRoute allowedRoles={['authority']}>
                    <AuthorityLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AuthorityDashboardPage />} />
                <Route path="dashboard" element={<AuthorityDashboardPage />} />
                <Route path="grievances" element={<AuthorityGrievancesPage />} />
                <Route path="assignments" element={<AuthorityAssignmentsPage />} />
                <Route path="blind-spots" element={<AuthorityBlindSpotsPage />} />
                <Route path="analytics" element={<AuthorityAnalyticsPage />} />
                <Route path="profile" element={<AuthorityProfilePage />} />
              </Route>

              {/* Field Officer Operations Console Routes */}
              <Route
                path="officer"
                element={
                  <ProtectedRoute allowedRoles={['field_officer']}>
                    <OfficerLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<OfficerDashboardPage />} />
                <Route path="dashboard" element={<OfficerDashboardPage />} />
                <Route path="assigned-work" element={<OfficerAssignedWorkPage />} />
                <Route path="inspections" element={<OfficerInspectionsPage />} />
                <Route path="profile" element={<OfficerProfilePage />} />
              </Route>

              {/* Milestone 4: System Administrator & Content Moderation Portal Routes */}
              <Route
                path="admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="moderation" element={<AdminModerationPage />} />
                <Route path="wards" element={<AdminWardsPage />} />
                <Route path="departments" element={<AdminDepartmentsPage />} />
                <Route path="categories" element={<AdminCategoriesPage />} />
                <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
                <Route path="profile" element={<AdminProfilePage />} />
              </Route>
            </Routes>
            </Suspense>
          </BrowserRouter>
        </ReportsProvider>
      </AuthProvider>
    </AccessibilityProvider>
  );
}

export default App;
