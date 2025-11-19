import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Messenger from "./pages/Messenger";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import SocialNetwork from "./pages/SocialNetwork";
import UserProfile from "./pages/UserProfile";
import BusinessEnvironment from "./pages/BusinessEnvironment";
import DocumentManagement from "./pages/DocumentManagement";
import Wallet from "./pages/Wallet";
import DigitalID from "./pages/DigitalID";
import IntegrationsPage from "./pages/IntegrationsPage";
import Travel from "./pages/Travel";
import Help from "./pages/Help";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/messenger" element={<Messenger />} />
          <Route path="/profile" element={<Profile />} />
        <Route path="/social-network" element={<SocialNetwork />} />
        <Route path="/user/:userId" element={<UserProfile />} />
          <Route path="/business-environment" element={<BusinessEnvironment />} />
          <Route path="/document-management" element={<DocumentManagement />} />
          <Route path="/wallet" element={<Wallet />} />
          <Route path="/digital-id" element={<DigitalID />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/travel" element={<Travel />} />
          <Route path="/help" element={<Help />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
