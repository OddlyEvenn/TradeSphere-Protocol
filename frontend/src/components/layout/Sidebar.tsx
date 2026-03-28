import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
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
    Gavel,
    Globe,
    ChevronLeft,
    Menu,
    LogOut
} from 'lucide-react';

interface SidebarProps {
    role: string;
    isCollapsed: boolean;
    onToggle: () => void;
    isMobile?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ role, isCollapsed, onToggle, isMobile }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        navigate('/login');
    };

    const getNavItems = () => {
        const common = [
            { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
            { name: 'Consensus', path: '/dashboard/voting', icon: Gavel },
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
                    { name: 'Clearance', path: '/dashboard/clearance', icon: ShieldCheck },
                    ...common.slice(1),
                ];
            case 'INSPECTOR':
                return [
                    ...common.slice(0, 1),
                    { name: 'Inspections', path: '/dashboard/inspections', icon: ClipboardCheck },
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
            default:
                return common;
        }
    };

    const navItems = getNavItems();

    return (
        <div className={`h-screen flex flex-col bg-white border-r border-slate-100 transition-all duration-500 ease-in-out relative ${isMobile ? 'w-full shadow-2xl' : isCollapsed ? 'w-24' : 'w-72'}`}>

            {/* Collapse Toggle Button (Desktop Only) */}
            {!isMobile && (
                <button
                    onClick={onToggle}
                    className="absolute -right-4 top-10 w-8 h-8 bg-white border border-slate-100 rounded-full flex items-center justify-center shadow-lg text-slate-400 hover:text-blue-600 transition-all z-50 group hover:scale-110"
                >
                    <ChevronLeft className={`transition-transform duration-500 ${isCollapsed ? 'rotate-180' : 'rotate-0'}`} size={16} />
                </button>
            )}

            <div className={`p-6 transition-all duration-500 ${isCollapsed ? 'px-4 flex justify-center' : 'p-8'}`}>
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-100 ring-4 ring-blue-50">
                        <ShieldCheck className="text-white" size={24} />
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col animate-in">
                            <span className="text-xl font-black tracking-tight text-slate-900 leading-none">TradeSphere</span>
                            <span className="text-[10px] font-black tracking-[0.2em] text-blue-500 uppercase mt-1">Protocol</span>
                        </div>
                    )}
                </div>
            </div>


            <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto no-scrollbar">
                {navItems.map((item) => (
                    <NavLink
                        key={item.name}
                        to={item.path}
                        end={item.path === '/dashboard'}
                        className={({ isActive }) =>
                            `${isActive ? 'nav-link-active' : 'nav-link'} ${isCollapsed ? 'justify-center px-0' : ''}`
                        }
                        title={isCollapsed ? item.name : undefined}
                    >
                        <item.icon size={22} className="flex-shrink-0" />
                        {!isCollapsed && <span className="animate-in whitespace-nowrap">{item.name}</span>}
                    </NavLink>
                ))}
            </nav>

            <div className="p-6">
                <div className={`bg-slate-50 rounded-[1.5rem] transition-all duration-500 ${isCollapsed ? 'p-2' : 'p-5'}`}>
                    <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                            <Landmark size={20} className="text-slate-400" />
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col animate-in min-w-0">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Role</p>
                                <p className="text-sm font-black text-slate-900 truncate uppercase">
                                    {role === 'CUSTOMS' ? 'CUSTOMS & TAX AUTHORITY' : role.replace(/_/g, ' ')}
                                </p>
                            </div>
                        )}
                    </div>
                    {!isCollapsed && (
                        <button
                            onClick={handleLogout}
                            className="w-full mt-4 flex items-center justify-center gap-2 text-xs font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest pt-4 border-t border-slate-200/50"
                        >
                            <LogOut size={14} />
                            Log Out
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Sidebar;

