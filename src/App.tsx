import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout/Layout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { LeadManagement } from '@/pages/LeadManagement';
import { Quotes } from '@/pages/Quotes';
import { Payments } from '@/pages/Payments';
import { ContactAttempts } from '@/pages/ContactAttempts';
import { CallAnalysis } from '@/pages/CallAnalysis';
import { ApcmAi } from '@/pages/ApcmAi';
import { APCM_AI_ENABLED } from '@/lib/featureFlags';
import { OutcomeCodes } from '@/pages/OutcomeCodes';
import { DiaryNew as Diary } from '@/pages/DiaryNew';
import { LeadTimeTracking } from '@/pages/LeadTimeTracking';
import { Reports } from '@/pages/Reports';
import { InstructionsAttributionReport } from '@/pages/InstructionsAttributionReport';
import { Settings } from '@/pages/Settings';
import { SolicitorFirms } from '@/pages/SolicitorFirms';
import { FirmPriceLists } from '@/pages/FirmPriceLists';
import { ComparisonLeads } from '@/pages/ComparisonLeads';
import { AutomationPage } from '@/pages/Automation';
import { QuoteAccept } from '@/pages/QuoteAccept';
import { PaymentSuccess } from '@/pages/PaymentSuccess';
import { InstructionForm } from '@/pages/InstructionForm';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/quote/accept/:token" element={<QuoteAccept />} />
          <Route path="/quote/payment-success/:token" element={<PaymentSuccess />} />
          <Route path="/instructions/:token" element={<InstructionForm />} />
          
          {/* Auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-management"
            element={
              <ProtectedRoute>
                <Layout>
                  <LeadManagement />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/quotes"
            element={
              <ProtectedRoute>
                <Layout>
                  <Quotes />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/call-analysis"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <CallAnalysis />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/apcm-ai"
            element={
              APCM_AI_ENABLED ? (
                <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                  <Layout>
                    <ApcmAi />
                  </Layout>
                </ProtectedRoute>
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route
            path="/contact-attempts"
            element={
              <ProtectedRoute>
                <Layout>
                  <ContactAttempts />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/outcome-codes"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <OutcomeCodes />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/diary"
            element={
              <ProtectedRoute>
                <Layout>
                  <Diary />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-time-tracking"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LeadTimeTracking />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/payments"
            element={
              <ProtectedRoute>
                <Layout>
                  <Payments />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports/instructions"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <InstructionsAttributionReport />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Reports />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Layout>
                  <Settings />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/solicitor-firms"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <SolicitorFirms />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/firm-price-lists"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <FirmPriceLists />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/comparison-leads"
            element={
              <ProtectedRoute allowedRoles={['Manager']}>
                <Layout>
                  <ComparisonLeads />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/automation"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <AutomationPage />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
