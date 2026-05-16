import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ScrollToTop from './components/layout/ScrollToTop';
import ImpersonationBanner from './components/layout/ImpersonationBanner';
import HomePage from './pages/HomePage';
import SignUpPage from './pages/SignUpPage';
import GetStartedPage from './pages/GetStartedPage';
import SignUpConfirmationPage from './pages/SignUpConfirmationPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import FavoritesPage from './pages/FavoritesPage';
import DashboardPage from './pages/DashboardPage';
import ExportPaymentDataPage from './pages/ExportPaymentDataPage';
import ProfilePage from './pages/ProfilePage';
import SetPasswordPage from './pages/SetPasswordPage';
import FrontChannelLogout from './pages/FrontChannelLogout';
import AuthMagicCallback from './pages/AuthMagicCallback';
import PropertyDetailsPage from './pages/PropertyDetailsPage';
import PropertiesPage from './pages/PropertiesPage';
import ManagePropertyPage from './pages/ManagePropertyPage';
import PropertyInquiryPage from './pages/PropertyInquiryPage';
import MessagesPage from './pages/MessagesPage';
import CalendarPage from './pages/CalendarPage';
import OpenProposalPage from './pages/OpenProposalPage';
import PaymentPage from './pages/PaymentPage';
import PaymentConfirmationPage from './pages/PaymentConfirmationPage';
import ListPropertyPage from './pages/ListPropertyPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import PageEditorPage from './pages/PageEditorPage';
import StaticPage from './pages/StaticPage';
import ButtonGalleryPage from './pages/ButtonGalleryPage';
import NewsInfoPage from './pages/NewsInfoPage';
import FAQPage from './pages/FAQPage';
import SignInPage from './pages/SignInPage';
import VenueLandingPage from './pages/VendorLandingPage';
import VendorLandingPage from './pages/VenueLandingPage';
import { useAuth } from './contexts/AuthContext';
import InquirySettingsPage from './pages/InquirySettingsPage';
import WebhookDebugPage from './pages/WebhookDebugPage';
import StripeTestPage from './pages/StripeTestPage';
import PaymentDebugPage from './pages/PaymentDebugPage';
import InquiryDebugPage from './pages/InquiryDebugPage';
import ProposalFinalizePage from './pages/ProposalFinalizePage';

function App() {
  const { loading, checkSessionStatus } = useAuth();
  
  // Add session check on initial load only
  useEffect(() => {
    // Check session on initial load
    checkSessionStatus();
    // No periodic checks here to avoid re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-800"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#FEFAF8]">
      <ScrollToTop />
      <ImpersonationBanner />
      <Header />
      <main className="flex-grow pt-24 sm:pt-24">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/getstarted" element={<GetStartedPage />} />
          <Route path="/signup/confirmation" element={<SignUpConfirmationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/export-payment-data" element={<ExportPaymentDataPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="/auth/front-channel-logout" element={<FrontChannelLogout />} />
          <Route path="/auth/magic" element={<AuthMagicCallback />} />
          <Route path="/property/:id" element={<PropertyDetailsPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/artworks" element={<PropertiesPage />} />
          <Route path="/properties/:id" element={<ManagePropertyPage />} />
          <Route path="/property/:id/inquire" element={<PropertyInquiryPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/open-proposal" element={<OpenProposalPage />} />
          <Route path="/proposal/:id/finalize" element={<ProposalFinalizePage />} />
          <Route path="/payment/:id" element={<PaymentPage />} />
          <Route path="/payment/:id/confirmation" element={<PaymentConfirmationPage />} />
          <Route path="/add-artwork" element={<ListPropertyPage />} />
          <Route path="/webhook-debug" element={<WebhookDebugPage />} />
          <Route path="/stripe-test" element={<StripeTestPage />} />
          <Route path="/payment-debug" element={<PaymentDebugPage />} />
          <Route path="/inquiry-debug" element={<InquiryDebugPage />} />
          <Route path="/inquiry-settings" element={<InquirySettingsPage />} />
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/pages/:id" element={<PageEditorPage />} />
          {/* Button Gallery for style testing */}
          <Route path="/button-gallery" element={<ButtonGalleryPage />} />
          {/* Vendor landing page */}
          <Route path="/vendor" element={<VendorLandingPage />} />
          {/* Venue landing page */}
          <Route path="/venue" element={<VenueLandingPage />} />
          {/* News & Info aggregated listing */}
          <Route path="/news-info" element={<NewsInfoPage />} />
          {/* FAQ route must come before the slug catch-all */}
          <Route path="/faq" element={<FAQPage />} />
          {/* Organization properties page - use different path to avoid conflict */}
          {/* Static page route - moved from /page/:slug to /:slug */}
          <Route path="/:slug" element={<StaticPage />} />
          {/* Add more routes here as they are developed */}
          <Route path="*" element={<HomePage />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

export default App;