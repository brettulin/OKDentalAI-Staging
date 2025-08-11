import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from '@/pages/Index';
import QAPage from '@/pages/QA';
import CallsPage from '@/pages/Calls';
import PatientsPage from '@/pages/Patients';
import AppointmentsPage from '@/pages/Appointments';
import SettingsPage from '@/pages/Settings';
import { Layout } from '@/components/Layout';
import { AuthProvider } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageSkeleton } from '@/components/PageSkeleton';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Layout>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                <Route path="/calls" element={<ErrorBoundary><CallsPage /></ErrorBoundary>} />
                <Route path="/patients" element={<ErrorBoundary><PatientsPage /></ErrorBoundary>} />
                <Route path="/appointments" element={<ErrorBoundary><AppointmentsPage /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
                <Route path="/qa" element={<ErrorBoundary><QAPage /></ErrorBoundary>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;