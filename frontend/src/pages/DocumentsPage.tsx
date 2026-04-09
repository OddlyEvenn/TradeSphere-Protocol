import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FileText, Download, Eye, Clock, CheckCircle2, Search } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface Document {
    id: string;
    tradeId: string;
    type: string;
    name: string;
    status: string;
    date: string;
    verified: boolean;
    ipfsHash?: string;
}

const DocumentsPage: React.FC = () => {
    const { user } = useOutletContext<{ user: any }>();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/trades');
            const trades = res.data;

            const docs: Document[] = [];
            trades.forEach((trade: any) => {
                if (trade.status !== 'CREATED' && trade.status !== 'OPEN_FOR_OFFERS') {
                    docs.push({
                        id: `doc-loc-${trade.id.slice(0, 8)}`,
                        tradeId: trade.id,
                        type: 'Letter of Credit',
                        name: `LOC-${(trade.productName || trade.product).substring(0, 3).toUpperCase()}-${trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : 'PENDING'}`,
                        status: ['LOC_ISSUED', 'LOC_VERIFIED', 'SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'CUSTOMS_CLEARED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status) ? 'ISSUED' : 'PENDING',
                        date: trade.createdAt,
                        verified: ['LOC_VERIFIED', 'SHIPPING_NOMINATED', 'GOODS_SHIPPED', 'DOCS_SUBMITTED', 'CUSTOMS_CLEARED', 'DOCS_VERIFIED', 'COMPLETED'].includes(trade.status),
                        ipfsHash: trade.letterOfCredit?.ipfsHash
                    });
                }
                if (['GOODS_SHIPPED', 'CUSTOMS_CLEARED', 'CUSTOMS_FLAGGED', 'ENTRY_REJECTED', 'VOTING_ACTIVE', 'GOODS_RECEIVED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status)) {
                    docs.push({
                        id: `doc-bol-${trade.id.slice(0, 8)}`,
                        tradeId: trade.id,
                        type: 'Bill of Lading',
                        name: `BOL-${trade.destination.substring(0, 3).toUpperCase()}-${trade.blockchainId !== null && trade.blockchainId !== undefined ? trade.blockchainId : 'PENDING'}`,
                        status: 'SUBMITTED',
                        date: trade.billOfLading?.createdAt || new Date().toISOString(),
                        verified: ['CUSTOMS_CLEARED', 'PAYMENT_AUTHORIZED', 'SETTLEMENT_CONFIRMED', 'COMPLETED'].includes(trade.status),
                        ipfsHash: trade.billOfLading?.ipfsHash
                    });
                }
            });
            setDocuments(docs);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load documents");
        } finally {
            setLoading(false);
        }
    };

    const handleViewDocument = (ipfsHash: string) => {
        if (!ipfsHash) {
            toast.info("IPFS hash still syncing. Please wait for on-chain confirmation.");
            return;
        }
        const url = ipfsHash.startsWith('http')
            ? ipfsHash
            : `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
        window.open(url, '_blank');
    };

    if (loading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-4 border-t-indigo-600"></div></div>;

    return (
        <div className="max-w-6xl mx-auto space-y-10">
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">Document Vault</h1>
                <p className="text-slate-500 font-medium mt-1">Access and verify all trade documents securely stored on IPFS.</p>
            </div>

            <div className="card-premium !p-0 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white">
                    <div className="relative w-72">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search documents..."
                            className="w-full bg-slate-50 border-none rounded-2xl py-3 pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 transition-all"
                        />
                    </div>
                </div>

                <table className="w-full text-left bg-white">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Document</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type / Trade</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                            <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {documents.map((doc: any) => (
                            <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-8 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 flex-shrink-0 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                                            <FileText size={20} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 text-sm">{doc.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(doc.date).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-8 py-5">
                                    <p className="text-xs font-bold text-slate-900">{doc.type}</p>
                                    <button
                                        onClick={() => navigate(`/dashboard/trades/${doc.tradeId}`)}
                                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-widest mt-0.5"
                                    >
                                        View Trade Details
                                    </button>
                                </td>
                                <td className="px-8 py-5">
                                    {doc.verified ? (
                                        <div className="flex items-center gap-1.5 text-emerald-600">
                                            <CheckCircle2 size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">Verified on-chain</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-amber-500">
                                            <Clock size={14} />
                                            <span className="text-[10px] font-black uppercase tracking-widest">{doc.status}</span>
                                        </div>
                                    )}
                                </td>
                                <td className="px-8 py-5 text-right">
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => handleViewDocument(doc.ipfsHash)}
                                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 rounded-xl transition-all shadow-sm group"
                                            title="View Document"
                                        >
                                            <Eye size={18} className="group-hover:scale-110 transition-transform" />
                                        </button>
                                        <button
                                            onClick={() => window.open(`https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`, '_blank')}
                                            className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-100 rounded-xl transition-all shadow-sm group"
                                            title="Download IPFS Hash"
                                        >
                                            <Download size={18} className="group-hover:scale-110 transition-transform" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {documents.length === 0 && (
                    <div className="p-20 text-center bg-white">
                        <FileText className="mx-auto text-slate-200 mb-4" size={48} />
                        <h3 className="text-xl font-bold text-slate-900">No Documents Found</h3>
                        <p className="text-slate-400 font-medium">Any trade documents uploaded will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentsPage;
