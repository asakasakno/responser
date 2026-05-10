import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Landing from "./pages/Landing";

// Lazy-loaded routes (keeps initial bundle small so Landing LCP renders fast)
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Generate = lazy(() => import("./pages/Generate"));
const Products = lazy(() => import("./pages/Products"));
const History = lazy(() => import("./pages/History"));
const Templates = lazy(() => import("./pages/Templates"));
const Pricing = lazy(() => import("./pages/Pricing"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ResponseSettings = lazy(() => import("./pages/ResponseSettings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsers"));
const AdminPaymentsPage = lazy(() => import("./pages/AdminPayments"));
const AdminEnergyPage = lazy(() => import("./pages/AdminEnergy"));
const AdminAIUsagePage = lazy(() => import("./pages/AdminAIUsage"));
const AdminConversionPage = lazy(() => import("./pages/AdminConversion"));
const AdminAlertsPage = lazy(() => import("./pages/AdminAlerts"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminCouponsPage = lazy(() => import("./pages/AdminCoupons"));
const Extension = lazy(() => import("./pages/Extension"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Refund = lazy(() => import("./pages/Refund"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Rewards = lazy(() => import("./pages/Rewards"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentFail = lazy(() => import("./pages/PaymentFail"));
const Contact = lazy(() => import("./pages/Contact"));
const AdminInquiries = lazy(() => import("./pages/AdminInquiries"));
const AdminAnomaliesPage = lazy(() => import("./pages/AdminAnomalies"));
const AdminAuditPage = lazy(() => import("./pages/AdminAudit"));
import FloatingContact from "./components/FloatingContact";

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="flex min-h-screen items-center justify-center text-muted-foreground">로딩 중...</div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <RouteFallback />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/extension" element={<Extension />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/generate" element={<ProtectedRoute><Generate /></ProtectedRoute>} />
              <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/response-settings" element={<ProtectedRoute><ResponseSettings /></ProtectedRoute>} />
              <Route path="/rewards" element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
              {/* Admin routes */}
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
              <Route path="/admin/payments" element={<ProtectedRoute><AdminPaymentsPage /></ProtectedRoute>} />
              <Route path="/admin/energy" element={<ProtectedRoute><AdminEnergyPage /></ProtectedRoute>} />
              <Route path="/admin/ai-usage" element={<ProtectedRoute><AdminAIUsagePage /></ProtectedRoute>} />
              <Route path="/admin/conversion" element={<ProtectedRoute><AdminConversionPage /></ProtectedRoute>} />
              <Route path="/admin/alerts" element={<ProtectedRoute><AdminAlertsPage /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<ProtectedRoute><AdminSettingsPage /></ProtectedRoute>} />
              <Route path="/admin/coupons" element={<ProtectedRoute><AdminCouponsPage /></ProtectedRoute>} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/refund" element={<Refund />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/payment/success" element={<PaymentSuccess />} />
              <Route path="/payment/fail" element={<PaymentFail />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/admin/inquiries" element={<ProtectedRoute><AdminInquiries /></ProtectedRoute>} />
              <Route path="/admin/anomalies" element={<ProtectedRoute><AdminAnomaliesPage /></ProtectedRoute>} />
              <Route path="/admin/audit" element={<ProtectedRoute><AdminAuditPage /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            <FloatingContact />
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
