import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Settings, User, Shield, Key, Bell, Save } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import api from '../services/api';

const SettingsPage: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('profile');
    const [manualWallet, setManualWallet] = useState(user.walletAddress || '');

    const handleSave = async () => {
        setLoading(true);
        try {
            // Save wallet override if changed
            if (manualWallet !== user.walletAddress) {
                const res = await api.post('/auth/update-wallet', {
                    userId: user.id,
                    walletAddress: manualWallet
                });

                // Update local storage so layout picks it up
                const updatedUser = { ...user, walletAddress: res.data.user.walletAddress };
                localStorage.setItem('user', JSON.stringify(updatedUser));

                // Force a page reload so context & TopNav grab the new localStorage wallet immediately
                window.location.reload();
                return; // halt execution here
            }

            // Normal simulated save for other things
            setTimeout(() => {
                setLoading(false);
                toast.success("Settings saved successfully.");
            }, 800);
        } catch (err) {
            console.error('Save failed', err);
            toast.error("Failed to save settings.");
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h1>
                <p className="text-slate-500 font-medium mt-1">Manage your profile, wallet configuration, and preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-1 space-y-2">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-2xl transition-all text-sm ${activeTab === 'profile' ? 'bg-white text-indigo-700 shadow-sm border border-slate-100' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'}`}
                    >
                        <User size={18} />
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-2xl transition-all text-sm ${activeTab === 'security' ? 'bg-white text-indigo-700 shadow-sm border border-slate-100' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'}`}
                    >
                        <Shield size={18} />
                        Security
                    </button>
                    <button
                        onClick={() => setActiveTab('contracts')}
                        className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-2xl transition-all text-sm ${activeTab === 'contracts' ? 'bg-white text-indigo-700 shadow-sm border border-slate-100' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'}`}
                    >
                        <Key size={18} />
                        Smart Contracts
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`w-full flex items-center gap-3 px-4 py-3 font-bold rounded-2xl transition-all text-sm ${activeTab === 'notifications' ? 'bg-white text-indigo-700 shadow-sm border border-slate-100' : 'bg-transparent text-slate-600 hover:bg-white hover:text-slate-900'}`}
                    >
                        <Bell size={18} />
                        Notifications
                    </button>
                </div>

                <div className="md:col-span-2 space-y-8">
                    {activeTab === 'profile' && (
                        <>
                            <div className="card-premium">
                                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                    <User className="text-indigo-600" />
                                    Personal Information
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Full Name / Entity Name</label>
                                        <input type="text" className="input-premium w-full" defaultValue={user.name} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Email Address</label>
                                        <input type="email" className="input-premium w-full bg-slate-50 text-slate-500 cursor-not-allowed" defaultValue={user.email} disabled />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">System Role</label>
                                        <input type="text" className="input-premium w-full bg-slate-50 text-slate-500 cursor-not-allowed uppercase font-black" defaultValue={user.role.replace('_', ' ')} disabled />
                                    </div>
                                </div>
                            </div>

                            <div className="card-premium">
                                <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                    <Key className="text-indigo-600" />
                                    Wallet Configuration
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Connected Web3 Wallet / Manual Override</label>
                                        <input
                                            type="text"
                                            className="input-premium w-full font-mono text-sm"
                                            value={manualWallet}
                                            onChange={(e) => setManualWallet(e.target.value)}
                                            placeholder="0x..."
                                        />
                                        <p className="text-xs text-slate-500 mt-2 font-medium">This wallet is used for all on-chain verification and signatures. You can connect via MetaMask or manually paste an address here to test different accounts on one PC.</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {activeTab === 'security' && (
                        <div className="card-premium">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <Shield className="text-indigo-600" />
                                Security Settings
                            </h2>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Change Password</label>
                                    <input type="password" placeholder="New Password" className="input-premium w-full mb-3" />
                                    <input type="password" placeholder="Confirm New Password" className="input-premium w-full" />
                                </div>
                                <div className="border-t border-slate-100 pt-6">
                                    <h3 className="font-bold text-slate-900 mb-2">Two-Factor Authentication</h3>
                                    <p className="text-sm text-slate-500 mb-4">Add an extra layer of security to your account using an authenticator app.</p>
                                    <button className="btn-secondary py-2 text-sm">Enable 2FA</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'contracts' && (
                        <div className="card-premium bg-slate-900 text-white shadow-2xl shadow-indigo-200/50">
                            <h2 className="text-xl font-black mb-6 flex items-center gap-2">
                                <Key className="text-indigo-400" />
                                Protocol Registry
                            </h2>
                            <p className="text-slate-400 mb-6 text-sm">The following are the active verified smart contract addresses configured for this interface.</p>
                            <div className="space-y-4 font-mono text-xs">
                                <div>
                                    <p className="text-slate-500 mb-1">Trade Registry Contract</p>
                                    <p className="bg-slate-800 p-3 rounded-lg text-indigo-300">0x0f965Ec7a519D9c50782A1bC6Cc0836E0C272Af4</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 mb-1">Letter of Credit Contract</p>
                                    <p className="bg-slate-800 p-3 rounded-lg text-indigo-300">0x66184b34777E58eb66Fa627C207ACaAc24f55224</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 mb-1">Document Verification Contract</p>
                                    <p className="bg-slate-800 p-3 rounded-lg text-indigo-300">0xF45337A8c134b50D247A5e62e7727e3F940a2F13</p>
                                </div>
                                <div>
                                    <p className="text-slate-500 mb-1">Payment Settlement Contract</p>
                                    <p className="bg-slate-800 p-3 rounded-lg text-indigo-300">0x580e39A1AdB5FEE9A117fF0A6B7acE44F4438359</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'notifications' && (
                        <div className="card-premium">
                            <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                                <Bell className="text-indigo-600" />
                                Notification Preferences
                            </h2>
                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                                    <input type="checkbox" className="w-5 h-5 accent-indigo-600" defaultChecked />
                                    <div>
                                        <p className="font-bold text-slate-900">Trade Status Updates</p>
                                        <p className="text-xs text-slate-500">Get notified when a trade advances to the next step.</p>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                                    <input type="checkbox" className="w-5 h-5 accent-indigo-600" defaultChecked />
                                    <div>
                                        <p className="font-bold text-slate-900">Document Verification Alerts</p>
                                        <p className="text-xs text-slate-500">Get notified when documents are uploaded or verified.</p>
                                    </div>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer p-4 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors">
                                    <input type="checkbox" className="w-5 h-5 accent-indigo-600" defaultChecked />
                                    <div>
                                        <p className="font-bold text-slate-900">Payment Confirmations</p>
                                        <p className="text-xs text-slate-500">Get notified when an on-chain settlement occurs.</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mx-2"></div> : <Save size={18} />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
