import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, Mail, Shield } from 'lucide-react';
import api from '../services/api';

const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/login', { email, password });
            localStorage.setItem('user', JSON.stringify(res.data.user));
            if (res.data.token) localStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Authentication failed');
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
            <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-slate-100">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-800 text-white mb-6">
                        <Shield size={32} />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">TradeSphere</h2>
                    <p className="mt-3 text-slate-500 font-medium">Institutional Access Portal</p>
                    {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold">{error}</div>}
                </div>

                <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all transition-duration-200"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Secure Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all transition-duration-200"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 px-6 bg-primary-800 hover:bg-primary-900 text-white font-bold rounded-2xl transition-all shadow-lg hover:shadow-primary-200 mt-4 active:scale-[0.98]"
                    >
                        Authenticate
                    </button>
                </form>

                <div className="text-center pt-2">
                    <p className="text-slate-500 font-medium">
                        New organization?{' '}
                        <Link to="/register" className="text-primary-700 hover:text-primary-900 font-bold decoration-2 underline-offset-4 hover:underline">
                            Create Profile
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
