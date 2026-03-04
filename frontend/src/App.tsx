import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/layout/DashboardLayout';
import DashboardHome from './pages/DashboardHome';
import ImporterDashboard from './pages/importer/ImporterDashboard';
import CreateTradeRequest from './pages/importer/CreateTradeRequest';
import ExporterDashboard from './pages/exporter/ExporterDashboard';
import MarketplaceDiscovery from './pages/exporter/MarketplaceDiscovery';
import BankRequests from './pages/bank/BankRequests';

// Placeholder components for portals
const Placeholder = ({ title }: { title: string }) => (
    <div className="card-premium">
        <h1 className="text-3xl font-black mb-4">{title}</h1>
        <p className="text-slate-500">This part of the TradeSphere Protocol is currently under construction.</p>
    </div>
);

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return <Navigate to="/login" replace />;

    const user = JSON.parse(storedUser);
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

function App() {
    return (
        <Router>
            <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Dashboard Routes */}
                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <DashboardLayout />
                        </ProtectedRoute>
                    }>
                        <Route index element={<DashboardHome />} />

                        {/* Importer Routes */}
                        <Route path="marketplace" element={<CreateTradeRequest />} />
                        <Route path="trades" element={<Placeholder title="My Trades" />} />

                        {/* Exporter Routes */}
                        <Route path="discovery" element={<MarketplaceDiscovery />} />
                        <Route path="shipments" element={<Placeholder title="Shipments" />} />

                        {/* Bank Routes */}
                        <Route path="requests" element={<BankRequests />} />
                        <Route path="approvals" element={<BankRequests />} />

                        {/* Authority Routes */}
                        <Route path="inspections" element={<Placeholder title="Customs Inspections" />} />
                        <Route path="fleet" element={<Placeholder title="Shipping Fleet" />} />
                        <Route path="policies" element={<Placeholder title="Insurance Policies" />} />
                        <Route path="compliance" element={<Placeholder title="Tax Compliance" />} />
                        <Route path="audits" element={<Placeholder title="Regulatory Audits" />} />

                        {/* Common Routes */}
                        <Route path="documents" element={<Placeholder title="Documents" />} />
                        <Route path="history" element={<Placeholder title="History" />} />
                        <Route path="settings" element={<Placeholder title="Settings" />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
