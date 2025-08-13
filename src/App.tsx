import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from '@/pages/Index';
import Patients from '@/pages/patients/PatientsList';
import PatientDetails from '@/pages/patients/PatientDetails';
import PatientForm from '@/pages/patients/PatientForm';
import Schedule from '@/pages/appointments/Schedule';
import Appointments from '@/pages/Appointments';
import Calls from '@/pages/Calls';
import CallDetails from '@/pages/calls/CallDetails';
import CallsExport from '@/pages/calls/CallsExport';
import PMS from '@/pages/PMS';
import Settings from '@/pages/Settings';
import AISettings from '@/pages/settings/AISettings';
import QA from '@/pages/QA';
import NotFound from '@/pages/NotFound';
import { Layout } from '@/components/Layout';
import { AuthProvider } from '@/hooks/useAuth';
import { SecurityProvider } from '@/components/security/SecurityProvider';
import { SessionTimeout } from '@/components/security/SessionTimeout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageSkeleton } from '@/components/PageSkeleton';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SecurityProvider>
          <SessionTimeout timeoutMinutes={30} warningMinutes={5} />
          <Router>
            <Layout>
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                <Route path="/patients" element={<ErrorBoundary><Patients /></ErrorBoundary>} />
                <Route path="/patients/new" element={<ErrorBoundary><PatientForm /></ErrorBoundary>} />
                <Route path="/patients/:id" element={<ErrorBoundary><PatientDetails /></ErrorBoundary>} />
                <Route path="/patients/:id/edit" element={<ErrorBoundary><PatientForm /></ErrorBoundary>} />
                <Route path="/appointments" element={<ErrorBoundary><Appointments /></ErrorBoundary>} />
                <Route path="/appointments/schedule" element={<ErrorBoundary><Schedule /></ErrorBoundary>} />
                <Route path="/calls" element={<ErrorBoundary><Calls /></ErrorBoundary>} />
                <Route path="/calls/:id" element={<ErrorBoundary><CallDetails /></ErrorBoundary>} />
                <Route path="/calls/export" element={<ErrorBoundary><CallsExport /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary><Settings /></ErrorBoundary>} />
                <Route path="/settings/ai" element={<ErrorBoundary><AISettings /></ErrorBoundary>} />
                <Route path="/pms" element={<ErrorBoundary><PMS /></ErrorBoundary>} />
                <Route path="/qa" element={<ErrorBoundary><QA /></ErrorBoundary>} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </Layout>
        </Router>
      </SecurityProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
}

export default App;