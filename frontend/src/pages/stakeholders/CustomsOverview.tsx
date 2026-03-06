import React from 'react';
import { ShieldCheck, Search, Activity, PackageCheck, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CustomsOverview: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Customs Authority Dashboard</h1>
                <p className="text-slate-500 font-medium mt-1">High-level overview of cross-border trade activity and national security metrics.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="card-premium space-y-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                        <Activity size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">142</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Active Imports</p>
                    </div>
                </div>
                <div className="card-premium space-y-4">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                        <PackageCheck size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">98.5%</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Clearance Rate</p>
                    </div>
                </div>
                <div className="card-premium space-y-4 border-amber-100 bg-amber-50/20">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-3xl font-black text-slate-900">4</p>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Flagged Shipments</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-12 text-white overflow-hidden relative shadow-2xl shadow-indigo-200/50 flex flex-col items-start gap-8">
                <div className="relative z-10 max-w-xl">
                    <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter text-white border-b border-slate-700 pb-4">Inspection Queue</h2>
                    <p className="text-slate-400 mt-4 leading-relaxed">
                        The Customs Inspection queue contains all shipments that have arrived at the border or submitted documents for clearance. You must manually inspect and cryptographically sign off on each shipment.
                    </p>
                </div>
                <button
                    onClick={() => navigate('/dashboard/inspections')}
                    className="btn-primary bg-white text-slate-900 px-8 hover:bg-slate-100 transition-all font-black relative z-10 flex items-center gap-2"
                >
                    <Search size={18} />
                    Open Inspection Queue
                </button>
                <ShieldCheck className="absolute -bottom-10 -right-10 text-white/5" size={300} />
            </div>
        </div>
    );
};

export default CustomsOverview;
