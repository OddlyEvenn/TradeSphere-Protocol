import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Globe, Lock, ArrowRight, CheckCircle } from 'lucide-react';

const Home: React.FC = () => {
    return (
        <div className="bg-white text-slate-900 min-h-screen">
            {/* Navigation */}
            <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="px-4 sm:px-6 lg:px-8 w-full">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-2">
                            <Shield className="h-8 w-8 text-primary-700" />
                            <span className="text-xl font-bold tracking-tight text-primary-900">TradeSphere</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-primary-700">Sign In</Link>
                            <Link to="/register" className="bg-primary-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-900 transition-all shadow-sm">Get Started</Link>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="py-20 px-4 sm:px-6 lg:px-8 text-center w-full">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-bold uppercase tracking-wider mb-6">
                    <Globe size={14} />
                    Blockchain Optimized Trade Finance
                </div>
                <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 tracking-tight lg:leading-[1.1] mb-6">
                    Modernizing Global Trade <br /> <span className="text-primary-700">Through Transparency.</span>
                </h1>
                <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10 leading-relaxed">
                    The decentralized protocol for secure, faster, and more transparent letter of credit issuance and settlement. Built on next-gen blockchain infrastructure.
                </p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link to="/register" className="bg-primary-800 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-900 transition-all shadow-lg hover:shadow-xl group">
                        Start Your Trade <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <button className="bg-white border border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold hover:bg-slate-50 transition-all">
                        View Live Status
                    </button>
                </div>
            </header>

            {/* Features */}
            <section className="py-20 bg-slate-50 border-y border-slate-100">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <FeatureCard
                            icon={<Lock className="text-primary-700" />}
                            title="Escrow Security"
                            description="Funds are locked on-chain and only released when independent verification signals match."
                        />
                        <FeatureCard
                            icon={<Shield className="text-primary-700" />}
                            title="Multi-Role Verification"
                            description="Semaphore-based approval model involving banks, customs, and trade partners."
                        />
                        <FeatureCard
                            icon={<Globe className="text-primary-700" />}
                            title="IPFS Immutability"
                            description="Trade documents are hashed and stored securely on IPFS, ensuring complete data integrity."
                        />
                    </div>
                </div>
            </section>

            {/* Trust Quote */}
            <footer className="py-12 border-t border-slate-100 text-center text-slate-400 text-sm">
                &copy; 2026 TradeSphere Protocol. All rights reserved. Secure institutional trade finance.
            </footer>
        </div>
    );
};

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center mb-6">
            {icon}
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
        <p className="text-slate-500 leading-relaxed">{description}</p>
    </div>
);

export default Home;
