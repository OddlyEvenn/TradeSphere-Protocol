import React, { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { walletService } from '../../services/WalletService';
import api from '../../services/api';

const DashboardLayout: React.FC = () => {
    const [user, setUser] = useState<any>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setUser(parsedUser);
        }
        setLoading(false);
    }, []);

    const handleConnectWallet = async () => {
        if (!user) return;
        const addr = await walletService.connect();
        if (addr) {
            setAccount(addr);
            try {
                await api.post('/auth/update-wallet', {
                    userId: user.id,
                    walletAddress: addr
                });
            } catch (err) {
                console.error("Failed to sync wallet address", err);
            }
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
        </div>
    );

    if (!user) return <Navigate to="/login" replace />;

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar role={user.role} />
            <div className="flex-1 flex flex-col">
                <TopNav user={user} account={account} onConnect={handleConnectWallet} />
                <main className="flex-1 p-8 overflow-auto">
                    <Outlet context={{ user, account }} />
                </main>
            </div>
        </div>
    );
};

export default DashboardLayout;
