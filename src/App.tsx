import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from '@/pages/Index';
import Auth from '@/pages/Auth';
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
import Production from '@/pages/Production';
import NotFound from '@/pages/NotFound';
import Analytics from '@/pages/Analytics';
import { Layout } from '@/components/Layout';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { SecurityProvider } from '@/components/security/SecurityProvider';
import { SessionTimeout } from '@/components/security/SessionTimeout';
import { RateLimitProvider } from '@/components/security/RateLimitedAction';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { PageSkeleton } from '@/components/PageSkeleton';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageSkeleton />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SecurityProvider>
          <Router>
            <Routes>
              <Route 
                path="/auth" 
                element={
                  <PublicRoute>
                    <Auth />
                  </PublicRoute>
                } 
              />
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Layout>
                      <SessionTimeout timeoutMinutes={30} warningMinutes={5} />
                      <Index />
                    </Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patients" 
                element={
                  <ProtectedRoute>
                    <Layout><Patients /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patients/new" 
                element={
                  <ProtectedRoute>
                    <Layout><PatientForm /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patients/:id" 
                element={
                  <ProtectedRoute>
                    <Layout><PatientDetails /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/patients/:id/edit" 
                element={
                  <ProtectedRoute>
                    <Layout><PatientForm /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/appointments" 
                element={
                  <ProtectedRoute>
                    <Layout><Appointments /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/appointments/schedule" 
                element={
                  <ProtectedRoute>
                    <Layout><Schedule /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calls" 
                element={
                  <ProtectedRoute>
                    <Layout><Calls /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calls/:id" 
                element={
                  <ProtectedRoute>
                    <Layout><CallDetails /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calls/export" 
                element={
                  <ProtectedRoute>
                    <Layout><CallsExport /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Layout><Settings /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings/ai" 
                element={
                  <ProtectedRoute>
                    <Layout><AISettings /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/pms" 
                element={
                  <ProtectedRoute>
                    <Layout><PMS /></Layout>
                  </ProtectedRoute>
                } 
               />
              <Route 
                path="/analytics" 
                element={
                  <ProtectedRoute>
                    <Layout><Analytics /></Layout>
                  </ProtectedRoute>
                } 
               />
              <Route 
                path="/qa" 
                element={
                  <ProtectedRoute>
                    <Layout><QA /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/production" 
                element={
                  <ProtectedRoute>
                    <Layout><Production /></Layout>
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
        </SecurityProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;