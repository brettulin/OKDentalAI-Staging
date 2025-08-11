import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Index from '@/pages/Index';
import QAPage from '@/pages/QA';
import CallsPage from '@/pages/Calls';
import PatientsPage from '@/pages/Patients';
import AppointmentsPage from '@/pages/Appointments';
import SettingsPage from '@/pages/Settings';
import { Layout } from '@/components/Layout';
import { AuthProvider } from '@/hooks/useAuth';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/calls" element={<CallsPage />} />
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/qa" element={<QAPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;