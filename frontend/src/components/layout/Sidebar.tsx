import React from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Package,
    FileText,
    ClipboardCheck,
    History,
    Settings,
    Truck,
    Landmark,
    ShieldCheck,
    Globe,
    Gavel,
    BadgePercent
} from 'lucide-react';

interface SidebarProps {
    role: string;
}

const Sidebar: React.FC<SidebarProps> = ({ role }) => {
    const getNavItems = () => {
        const common = [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Documents', path: '/dashboard/documents', icon: FileText },
            { name: 'History', path: '/dashboard/history', icon: History },
            { name: 'Settings', path: '/dashboard/settings', icon: Settings },
        ];

        switch (role) {
            case 'IMPORTER':
                return [
                    ...common.slice(0, 1),
                    { name: 'Marketplace', path: '/dashboard/marketplace', icon: Globe },
                    { name: 'My Trades', path: '/dashboard/trades', icon: Package },
                    ...common.slice(1),
                ];
            case 'EXPORTER':
                return [
                    ...common.slice(0, 1),
                    { name: 'Discovery', path: '/dashboard/discovery', icon: Globe },
                    { name: 'Shipments', path: '/dashboard/shipments', icon: Truck },
                    ...common.slice(1),
                ];
            case 'IMPORTER_BANK':
            case 'EXPORTER_BANK':
                return [
                    ...common.slice(0, 1),
                    { name: 'Requests', path: '/dashboard/requests', icon: Landmark },
                    { name: 'Approvals', path: '/dashboard/approvals', icon: ClipboardCheck },
                    ...common.slice(1),
                ];
            case 'CUSTOMS':
                return [
                    ...common.slice(0, 1),
                    { name: 'Inspections', path: '/dashboard/inspections', icon: ShieldCheck },
                    ...common.slice(1),
                ];
            case 'SHIPPING':
                return [
                    ...common.slice(0, 1),
                    { name: 'Fleet', path: '/dashboard/fleet', icon: Truck },
                    ...common.slice(1),
                ];
            case 'INSURANCE':
                return [
                    ...common.slice(0, 1),
                    { name: 'Policies', path: '/dashboard/policies', icon: ShieldCheck },
                    ...common.slice(1),
                ];
            case 'TAX':
                return [
                    ...common.slice(0, 1),
                    { name: 'Compliance', path: '/dashboard/compliance', icon: BadgePercent },
                    ...common.slice(1),
                ];
            case 'REGULATOR':
                return [
                    ...common.slice(0, 1),
                    { name: 'Audits', path: '/dashboard/audits', icon: Gavel },
                    ...common.slice(1),
                ];
            default:
                return common;
        }
    };

    const navItems = getNavItems();

    return (
        <div className="w-64 bg-white border-r border-slate-100 flex flex-col h-screen sticky top-0">
            <div className="p-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    <span className="text-xl font-black tracking-tight text-slate-900">TradeSphere</span>
                </div>
            </div>

            <nav className="flex-1 px-4 space-y-2">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        end={item.path === '/dashboard'}
                        className={({ isActive }) =>
                            isActive ? 'nav-link-active' : 'nav-link'
                        }
                    >
                        <item.icon size={20} />
                        <span>{item.name}</span>
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <div className="bg-slate-50 rounded-2xl p-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{role.replace('_', ' ')}</p>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
