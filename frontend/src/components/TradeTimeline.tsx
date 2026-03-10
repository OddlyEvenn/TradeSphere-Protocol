import React, { useState } from 'react';
import { Clock, FileText, ExternalLink, ShieldCheck, User, CheckCircle2, DollarSign, XCircle, ChevronLeft, ChevronRight } from 'lucide-react';
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
    const [currentPage, setCurrentPage] = useState(1);
    const eventsPerPage = 5;

    if (!events || events.length === 0) {
        return (
            <div className="card-premium py-12 text-center bg-white/60 backdrop-blur-md border-white/60">
                <Clock className="mx-auto text-slate-300 mb-4" size={32} />
                <p className="text-slate-500 font-bold mb-1">Audit Trail Empty</p>
                <p className="text-slate-400 text-sm">Blockchain-verified events will materialize here chronologically.</p>
            </div>
        );
    }

    const totalPages = Math.ceil(events.length / eventsPerPage);
    const startIndex = (currentPage - 1) * eventsPerPage;
    const currentEvents = events.slice(startIndex, startIndex + eventsPerPage);

    return (
        <div className="card-premium bg-white/60 backdrop-blur-md border-white/60">
            <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-2">
                <ShieldCheck className="text-blue-600" />
                Immutable Audit Trail
            </h2>
            <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
                {currentEvents.map((event, index) => (
                    <div key={event.id} className="relative pl-8 group">
                        {/* Timeline Dot */}
                        <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full bg-white border-4 border-slate-100 flex items-center justify-center group-hover:border-blue-100 transition-colors shadow-sm">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl p-5 shadow-sm group-hover:shadow-md hover:translate-x-1 transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 flex-shrink-0 bg-slate-50/50 rounded-lg group-hover:bg-blue-50 transition-colors">
                                        {getEventIcon(event.event)}
                                    </div>
                                    <h3 className="font-black text-slate-900 leading-none">
                                        {formatEventName(event.event)}
                                    </h3>
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                                    {format(new Date(event.createdAt), "MMM dd, yyyy HH:mm")}
                                </span>
                            </div>

                            <div className="flex items-center gap-2 mt-3 mb-4">
                                <User size={14} className="text-slate-400" />
                                <span className="text-xs font-black text-slate-700">
                                    {event.actor?.name || 'Protocol Actor'}
                                    <span className="text-slate-400 font-bold ml-1">({event.actorRole.replace('_', ' ')})</span>
                                </span>
                            </div>

                            {(event.txHash || event.ipfsHash) && (
                                <div className="flex flex-wrap gap-2 pt-4 border-t border-white/60">
                                    {event.txHash && (
                                        <a
                                            href={`https://sepolia.etherscan.io/tx/${event.txHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <ExternalLink size={12} />
                                            View On-Chain: {event.txHash.substring(0, 6)}...{event.txHash.substring(event.txHash.length - 4)}
                                        </a>
                                    )}
                                    {event.ipfsHash && (
                                        <a
                                            href={event.ipfsHash.startsWith('http') ? event.ipfsHash : `https://gateway.pinata.cloud/ipfs/${event.ipfsHash}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                        >
                                            <FileText size={12} />
                                            View Instrument
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100/50">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        <ChevronLeft size={16} />
                        Previous
                    </button>
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                        Next
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default TradeTimeline;
