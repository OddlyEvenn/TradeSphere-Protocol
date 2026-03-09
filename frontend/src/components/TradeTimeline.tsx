import React from 'react';
import { Clock, FileText, ExternalLink, ShieldCheck, User, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export interface TradeEvent {
    id: string;
    tradeId: string;
    actor?: { name: string; role: string; id: string };
    actorRole: string;
    event: string;
    txHash?: string | null;
    ipfsHash?: string | null;
    createdAt: string;
}

interface TradeTimelineProps {
    events: TradeEvent[];
}

const getEventIcon = (eventName: string) => {
    const name = eventName.toUpperCase();
    if (name.includes('CREATED') || name.includes('INITIATED')) return <Clock size={16} className="text-blue-500" />;
    if (name.includes('UPLOADED') || name.includes('ISSUED')) return <FileText size={16} className="text-amber-500" />;
    if (name.includes('APPROVED') || name.includes('CLEARED') || name.includes('AUTHORIZED')) return <ShieldCheck size={16} className="text-emerald-500" />;
    if (name.includes('COMPLETED') || name.includes('CONFIRMED') || name.includes('SETTLEMENT')) return <CheckCircle2 size={16} className="text-indigo-500" />;
    if (name.includes('PAID')) return <DollarSign size={16} className="text-emerald-500" />;
    if (name.includes('DISPUTED')) return <XCircle size={16} className="text-rose-500" />;
    return <Clock size={16} className="text-slate-400" />;
};


const formatEventName = (eventName: string) => {
    return eventName.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
};

const TradeTimeline: React.FC<TradeTimelineProps> = ({ events }) => {
    if (!events || events.length === 0) {
        return (
            <div className="card-premium py-12 text-center bg-slate-50/50">
                <Clock className="mx-auto text-slate-300 mb-4" size={32} />
                <p className="text-slate-500 font-bold mb-1">No timeline events recorded yet</p>
                <p className="text-slate-400 text-sm">Actions on this trade will appear here chronologically.</p>
            </div>
        );
    }

    return (
        <div className="card-premium">
            <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2">
                <ShieldCheck className="text-indigo-600" />
                Immutable Audit Trail
            </h2>
            <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
                {events.map((event, index) => (
                    <div key={event.id} className="relative pl-8 group">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full bg-white border-4 border-slate-100 flex items-center justify-center group-hover:border-indigo-100 transition-colors">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                        </div>

                        <div className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm group-hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-50 rounded-lg">
                                        {getEventIcon(event.event)}
                                    </div>
                                    <h3 className="font-bold text-slate-900 leading-none">
                                        {formatEventName(event.event)}
                                    </h3>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                                    {format(new Date(event.createdAt), "MMM dd, yyyy HH:mm")}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-3 mb-4">
                                <User size={14} className="text-slate-400" />
                                <span className="text-xs font-semibold text-slate-700">
                                    {event.actor?.name || 'Unknown Actor'}
                                    <span className="text-slate-400 font-medium ml-1">({event.actorRole.replace('_', ' ')})</span>
                                </span>
                            </div>

                            {(event.txHash || event.ipfsHash) && (
                                <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-50">
                                    {event.txHash && (
                                        <a
                                            href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-indigo-100 transition-colors"
                                        >
                                            <ExternalLink size={12} />
                                            View TX: {event.txHash.substring(0, 6)}...{event.txHash.substring(event.txHash.length - 4)}
                                        </a>
                                    )}
                                    {event.ipfsHash && (
                                        <a
                                            href={`https://gateway.pinata.cloud/ipfs/${event.ipfsHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wide rounded-lg hover:bg-emerald-100 transition-colors"
                                        >
                                            <FileText size={12} />
                                            View Document
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TradeTimeline;
