import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import GlobalLoader from '../common/GlobalLoader';
import { walletService } from '../../services/WalletService';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

const DashboardLayout: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [account, setAccount] = useState<string | null>(null);
    const toast = useToast();
    const [loading, setLoading] = useState(true);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
        }
        setLoading(false);

        // Responsive sidebar logic
        const handleResize = () => {
            if (window.innerWidth < 1024) {
                setIsSidebarCollapsed(true);
            } else {
                setIsSidebarCollapsed(false);
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleConnectWallet = async () => {
        if (!user) return;
        const addr = await walletService.connect();
        if (addr) {
            setAccount(addr);
            
            // Sync if the address is DIFFERENT from the one in local state OR if local state is missing it
            if (addr.toLowerCase() !== user.walletAddress?.toLowerCase() || !user.walletAddress) {
                try {
                    const res = await api.post('/auth/update-wallet', {
                        userId: user.id,
                        walletAddress: addr
                    });
                    // Update local user state
                    const updatedUser = res.data.user;
                    setUser(updatedUser);
                    localStorage.setItem('user', JSON.stringify(updatedUser));
                    toast.success("Identity Secured! Your wallet is now linked to this node.");
                } catch (err) {
                    console.error("Failed to sync wallet address", err);
                }
            }
        }
    };

    if (loading) return null; // Handled by GlobalLoader in App or here

    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="flex min-h-screen bg-slate-50 transition-colors duration-500">
            <GlobalLoader />

            {/* Sidebar for Desktop */}
            <div className={`hidden lg:block sticky top-0 h-screen transition-all duration-500 ease-in-out ${isSidebarCollapsed ? 'w-24' : 'w-72'}`}>
                <Sidebar
                    role={user.role}
                    isCollapsed={isSidebarCollapsed}
                    onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
            </div>

            {/* Sidebar for Mobile */}
            <div className={`lg:hidden fixed inset-0 z-50 transition-opacity duration-300 ${isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
                <div className={`absolute left-0 top-0 bottom-0 w-72 transition-transform duration-500 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <Sidebar
                        role={user.role}
                        isCollapsed={false}
                        onToggle={() => setIsMobileMenuOpen(false)}
                        isMobile
                    />
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <TopNav
                    user={user}
                    account={account}
                    onConnect={handleConnectWallet}
                    onMenuClick={() => setIsMobileMenuOpen(true)}
                    isSidebarCollapsed={isSidebarCollapsed}
                />
                <main className="flex-1 p-4 lg:p-10 overflow-auto animate-in">
                    <div className="max-w-[1600px] mx-auto">
                        <Outlet context={{ user, account }} />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;

