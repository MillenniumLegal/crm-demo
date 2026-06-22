import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Layout } from '@/components/Layout/Layout';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import PipelinePulse from '@/pages/PipelinePulse';
import DailyPipeline from '@/pages/DailyPipeline';
import Finance from '@/pages/Finance';
import Matters from '@/pages/Matters';
import Analytics from '@/pages/Analytics';
import TeamPerformance from '@/pages/TeamPerformance';
import Marketing from '@/pages/Marketing';
import RecoveryEngine from '@/pages/RecoveryEngine';
import {
  AiOutreachCommandCentre,
  ContactIntelligenceCentre,
  DormantLeadVault,
  LifecycleGrowthEngine,
  SecondChanceRevenueDashboard,
} from '@/pages/RecoveryExpansionPages';
import Email from '@/pages/Email';
import CallIntel from '@/pages/CallIntel';
import MatterProgression from '@/pages/MatterProgression';
import AgentWorkspace from '@/pages/AgentWorkspace';
import Conversations from '@/pages/Conversations';
import RevenueBoost from '@/pages/RevenueBoost';
import Compliance from '@/pages/Compliance';
import LeadResale from '@/pages/LeadResale';
import LeadResaleQueue from '@/pages/LeadResaleQueue';
import OpsHealth from '@/pages/OpsHealth';
import ClientExperience from '@/pages/ClientExperience';
import SalesVelocity from '@/pages/SalesVelocity';
import Capacity from '@/pages/Capacity';
import Forecast from '@/pages/Forecast';
import Timing from '@/pages/Timing';
import CallInsights from '@/pages/CallInsights';
import LeadAnalytics from '@/pages/LeadAnalytics';
import LeadEnrichment from '@/pages/LeadEnrichment';
import LeadCategories from '@/pages/LeadCategories';
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
            path="/pipeline-pulse"
            element={
              <ProtectedRoute>
                <Layout>
                  <PipelinePulse />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/daily-pipeline"
            element={
              <ProtectedRoute>
                <Layout>
                  <DailyPipeline />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute>
                <Layout>
                  <Finance />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/matters"
            element={
              <ProtectedRoute>
                <Layout>
                  <Matters />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Analytics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <TeamPerformance />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/marketing"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Marketing />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Email />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/recovery-engine"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <RecoveryEngine />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lifecycle-growth"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LifecycleGrowthEngine />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contact-intelligence"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <ContactIntelligenceCentre />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-outreach-command"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <AiOutreachCommandCentre />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dormant-lead-vault"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <DormantLeadVault />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/second-chance-revenue"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <SecondChanceRevenueDashboard />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/call-intel"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <CallIntel />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/matter-progression"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <MatterProgression />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-workspace"
            element={
              <ProtectedRoute>
                <Layout>
                  <AgentWorkspace />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/conversations"
            element={
              <ProtectedRoute>
                <Layout>
                  <Conversations />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/revenue-boost"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <RevenueBoost />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/compliance"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Compliance />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-resale"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LeadResale />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-resale-queue"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LeadResaleQueue />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ops-health"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <OpsHealth />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/client-experience"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <ClientExperience />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales-velocity"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <SalesVelocity />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/capacity"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Capacity />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/forecast"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Forecast />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/timing"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <Timing />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/call-insights"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <CallInsights />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-analytics"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LeadAnalytics />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-enrichment"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LeadEnrichment />
                </Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/lead-categories"
            element={
              <ProtectedRoute allowedRoles={['Admin', 'Manager']}>
                <Layout>
                  <LeadCategories />
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
