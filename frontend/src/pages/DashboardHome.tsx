import React from 'react';
import { useOutletContext } from 'react-router-dom';
import ImporterDashboard from './importer/ImporterDashboard';
import ExporterDashboard from './exporter/ExporterDashboard';
import ImporterBankDashboard from './bank/ImporterBankDashboard';
import ExporterBankDashboard from './bank/ExporterBankDashboard';
import ShippingDashboard from './stakeholders/ShippingDashboard';
import CustomsOverview from './stakeholders/CustomsOverview';
import TaxDashboard from './stakeholders/TaxDashboard';
import RegulatorDashboard from './stakeholders/RegulatorDashboard';

const DashboardHome: React.FC = () => {
    const { user, account } = useOutletContext<{ user: any, account: string | null }>();

    if (!user) return null;

    switch (user.role) {
        case 'IMPORTER': return <ImporterDashboard />;
        case 'EXPORTER': return <ExporterDashboard />;
        case 'IMPORTER_BANK': return <ImporterBankDashboard />;
        case 'EXPORTER_BANK': return <ExporterBankDashboard />;
        case 'CUSTOMS': return <CustomsOverview />;
        case 'SHIPPING': return <ShippingDashboard />;
        case 'TAX_AUTHORITY': return <TaxDashboard />;
        case 'REGULATORS': return <RegulatorDashboard />;
        case 'INSURANCE': return <div className="card-premium h-96 flex items-center justify-center font-black text-slate-400 uppercase tracking-widest">Insurance Portal Active</div>;
        default:
            return (
                <div className="card-premium">
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Welcome, {user.name}</h2>
                    <p className="text-slate-500 font-medium">Your portal ({user.role}) is being prepared. Please select an option from the sidebar.</p>
                </div>
            );
    }
};

export default DashboardHome;
