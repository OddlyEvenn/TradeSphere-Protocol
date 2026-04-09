import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, User, Mail, Lock, Briefcase } from 'lucide-react';
import api from '../services/api';

const Register: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'IMPORTER'
    });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await api.post('/auth/register', formData);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            if (res.data.token) localStorage.setItem('token', res.data.token);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8 font-sans">
            <div className="w-full max-w-2xl space-y-8 bg-white p-12 rounded-[2rem] shadow-[0_25px_60px_rgba(0,0,0,0.06)] border border-slate-100">
                <div className="text-center mb-10">
                    <Shield className="mx-auto h-14 w-14 text-primary-800" />
                    <h2 className="mt-6 text-4xl font-black text-slate-900 tracking-tight">Create Organization</h2>
                    <p className="mt-3 text-slate-500 font-medium">Join the TradeSphere decentralized network</p>
                    {error && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold">{error}</div>}
                </div>

                <form className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={handleSubmit}>
                    <div className="space-y-6">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 transition-colors group-focus-within:text-primary-800">Entity Name</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                                    placeholder="e.g. Acme Corp"
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 transition-colors group-focus-within:text-primary-800">Business Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                                    placeholder="contact@entity.com"
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1 transition-colors group-focus-within:text-primary-800">Secure Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-900 transition-all focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                                    placeholder="••••••••"
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="group">
                            <label className="block text-sm font-bold text-slate-700 mb-2 ml-1">Protocol Role</label>
                            <div className="relative">
                                <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                                <select
                                    className="block w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-10 text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white transition-all cursor-pointer"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="IMPORTER">Importer</option>
                                    <option value="EXPORTER">Exporter</option>
                                    <option value="IMPORTER_BANK">Importer Bank</option>
                                    <option value="EXPORTER_BANK">Exporter Bank</option>
                                    <option value="SHIPPING">Shipping</option>
                                    <option value="INSURANCE">Insurance</option>
                                    <option value="CUSTOMS">Customs & Tax Authority</option>
                                    <option value="INSPECTOR">Inspector Node</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="md:col-span-2 pt-4">
                        <button
                            type="submit"
                            className="w-full rounded-2xl bg-primary-800 px-6 py-5 text-lg font-black text-white hover:bg-primary-900 transition-all shadow-xl hover:shadow-primary-100 active:scale-[0.99]"
                        >
                            Request Access
                        </button>
                    </div>
                </form>

                <p className="text-center text-slate-500 font-medium">
                    Already registered?{' '}
                    <Link to="/login" className="text-primary-700 hover:text-primary-900 font-bold decoration-2 underline-offset-4 hover:underline">
                        Member Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
