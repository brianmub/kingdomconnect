import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/services/supabase';
import { useOrganization } from '@/hooks/useOrganization';
import {
    Loader2,
    Search,
    Filter,
    Banknote,
    Download,
    Printer,
    History,
    ChevronRight,
    User,
    Calendar,
    ArrowUpRight,
    Plus,
    XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, GlassBox } from '@/components/ui/Card';
import { ReceiptModal } from '@/components/shared/ReceiptModal';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';

export function PaymentsPage() {
    const { organization } = useOrganization();
    const { profile } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [totalRevenue, setTotalRevenue] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<any>(null);
    const [isNewPaymentModalOpen, setIsNewPaymentModalOpen] = useState(false);
    const PAGE_SIZE = 20;

    useEffect(() => {
        if (organization?.id) {
            setPage(0);
            setPayments([]);
            setHasMore(true);
            fetchPayments(0, true);
            fetchTotalStats();
        }
    }, [organization?.id]);

    const fetchTotalStats = async () => {
        try {
            const { data } = await supabase
                .from('payment_records')
                .select('amount')
                .eq('organization_id', organization!.id)
                .eq('status', 'paid');
            const total = (data || []).reduce((sum, p) => sum + p.amount, 0);
            setTotalRevenue(total);
        } catch (err) {
            console.error('Error fetching total revenue:', err);
        }
    };

    const fetchPayments = async (pageNum: number, isInitial: boolean = false) => {
        try {
            setLoading(true);
            const from = pageNum * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const { data, error } = await supabase
                .from('payment_records')
                .select(`
                    id, amount, created_at, receipt_number, payment_method, status,
                    user:user_id(first_name, surname, email, profile_photo_url),
                    program:program_id(name),
                    session:session_id(name, session_date)
                `)
                .eq('organization_id', organization!.id)
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;
            
            if (data) {
                if (isInitial) {
                    setPayments(data);
                } else {
                    setPayments(prev => [...prev, ...data]);
                }
                setHasMore(data.length === PAGE_SIZE);
            }
        } catch (err) {
            console.error('Error fetching payments:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchPayments(nextPage);
    };

    const filteredPayments = payments.filter(p =>
        p.user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.user?.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.receipt_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
        total: totalRevenue,
        count: payments.length,
        today: payments.filter(p => new Date(p.created_at).toDateString() === new Date().toDateString())
            .reduce((sum, p) => sum + p.amount, 0)
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tighter uppercase italic">
                        Payments <span className="text-primary">List</span>
                    </h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                        History of all money received
                    </p>
                </div>
                <Button
                    variant="premium"
                    className="h-12 px-8 font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-primary/10"
                    onClick={() => setIsNewPaymentModalOpen(true)}
                >
                    <Plus className="w-4 h-4 mr-2" /> Record Manual Payment
                </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Received', value: `$${stats.total.toLocaleString()}`, icon: <Banknote className="w-5 h-5 text-emerald-600" />, trend: 'Overall' },
                    { label: 'Today\'s Payments', value: `$${stats.today.toLocaleString()}`, icon: <ArrowUpRight className="w-5 h-5 text-primary" />, trend: 'Today' },
                    { label: 'Total Payments Count', value: stats.count, icon: <History className="w-5 h-5 text-pink-600" />, trend: 'Total' },
                ].map((stat, i) => (
                    <GlassBox key={i} className="p-6 border-surface-border bg-surface">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-background rounded-xl border border-surface-border">
                                {stat.icon}
                            </div>
                            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md uppercase tracking-widest">
                                {stat.trend}
                            </span>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                        <p className="text-3xl font-black text-foreground tracking-tighter">{stat.value}</p>
                    </GlassBox>
                ))}
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by participant name or receipt number..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-14 bg-background border border-surface-border rounded-2xl pl-12 pr-6 text-sm font-bold text-foreground outline-none focus:bg-surface focus:border-primary/30 transition-all font-sans"
                    />
                </div>
                <Button variant="outline" className="h-14 px-8 border-surface-border bg-background text-slate-500 hover:text-foreground font-black uppercase tracking-widest text-[10px]">
                    <Filter className="w-4 h-4 mr-2" /> Filters
                </Button>
            </div>

            {/* History Table */}
            <Card className="p-0 overflow-hidden bg-surface border-surface-border">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-500">
                        <thead className="bg-background text-xs uppercase font-black text-foreground tracking-wider border-b border-surface-border">
                            <tr>
                                <th className="px-8 py-5">Receipt Info</th>
                                <th className="px-8 py-5">Participant</th>
                                <th className="px-8 py-5">For</th>
                                <th className="px-8 py-5">Amount</th>
                                <th className="px-8 py-5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-20 text-center">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-4">Loading Payments...</p>
                                    </td>
                                </tr>
                            ) : filteredPayments.map((payment) => (
                                <tr key={payment.id} className="hover:bg-background transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                            <div>
                                                <div className="text-foreground font-mono font-bold text-xs">#{payment.receipt_number}</div>
                                                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                                    {new Date(payment.created_at).toLocaleDateString()} • {payment.payment_method}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-background border border-surface-border flex items-center justify-center font-black text-[10px] text-primary">
                                                {payment.user?.first_name?.[0]}{payment.user?.surname?.[0]}
                                            </div>
                                            <div>
                                                <div className="text-foreground font-bold">{payment.user?.first_name} {payment.user?.surname}</div>
                                                <div className="text-[10px] opacity-60">{payment.user?.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-primary">
                                                <Calendar className="w-3 h-3" />
                                                <span className="text-[10px] font-black uppercase tracking-wider">{payment.program?.name}</span>
                                            </div>
                                            {payment.session && (
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest pl-5">
                                                    Session: {payment.session.name}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 italic">
                                        <div className="text-foreground font-black text-lg tracking-tighter">
                                            ${payment.amount.toFixed(2)}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-10 px-4 bg-background text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-foreground border border-transparent hover:border-surface-border"
                                            onClick={() => {
                                                setSelectedPayment(payment);
                                                setIsReceiptModalOpen(true);
                                            }}
                                        >
                                            <Printer className="w-3.5 h-3.5 mr-2" /> Print Receipt
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {hasMore && (
                        <div className="flex justify-center mt-6 pb-6 border-t border-surface-border pt-6">
                            <Button 
                                variant="ghost" 
                                className="px-10 h-12 font-black uppercase tracking-widest text-[9px] border border-surface-border hover:border-primary/40 transition-all rounded-xl"
                                onClick={loadMore}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Load More Payments'}
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            {/* Receipt Modal */}
            {isReceiptModalOpen && selectedPayment && (
                <ReceiptModal
                    isOpen={isReceiptModalOpen}
                    onClose={() => setIsReceiptModalOpen(false)}
                    payment={selectedPayment}
                    organization={organization}
                />
            )}

            {/* New Payment Modal */}
            <AnimatePresence>
                {isNewPaymentModalOpen && (
                    <NewPaymentModal
                        organization={organization}
                        profile={profile}
                        onClose={() => setIsNewPaymentModalOpen(false)}
                        onSuccess={(newData?: any[]) => {
                            if (newData) {
                                setPayments(newData);
                            } else {
                                setIsNewPaymentModalOpen(false);
                                fetchPayments(0, true);
                            }
                        }}
                        onOpenReceipt={(payment) => {
                            setSelectedPayment(payment);
                            setIsReceiptModalOpen(true);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

function createSuggestedReceiptNumber(method: string) {
    const normalizedMethod = (method || 'cash').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || 'PAY';
    const timestamp = Date.now().toString().slice(-8);
    return `${normalizedMethod}-${timestamp}`;
}

function NewPaymentModal({ organization, profile, onClose, onSuccess, onOpenReceipt }: { 
    organization: any, 
    profile: any, 
    onClose: () => void, 
    onSuccess: (data?: any[]) => void,
    onOpenReceipt: (payment: any) => void
}) {
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [userEnrollments, setUserEnrollments] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedSessionData, setSelectedSessionData] = useState<string>(''); // Format: programId:sessionId or programId:none
    const [amount, setAmount] = useState(10);
    const [method, setMethod] = useState('cash');
    const [receiptNumber, setReceiptNumber] = useState('');
    const [continuousMode, setContinuousMode] = useState(true);
    const [lastPayment, setLastPayment] = useState<any>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (search.length > 2) {
            const delay = setTimeout(searchUsers, 250);
            return () => clearTimeout(delay);
        }
    }, [search]);

    const searchUsers = useCallback(async () => {
        if (!search.trim() || !organization?.id) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, first_name, surname, email, phone_number')
                .eq('organization_id', organization.id)
                .or(`first_name.ilike.%${search}%,surname.ilike.%${search}%,email.ilike.%${search}%,phone_number.ilike.%${search}%`)
                .limit(20);
            
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Search error:', err);
        } finally {
            setLoading(false);
        }
    }, [search, organization?.id]);

    useEffect(() => {
        if (selectedUser) {
            fetchUserFinancialData();
        }
    }, [selectedUser]);

    useEffect(() => {
        setReceiptNumber((currentValue) => {
            if (!currentValue || /^[A-Z0-9]+-\d{8}$/.test(currentValue)) {
                return createSuggestedReceiptNumber(method);
            }
            return currentValue;
        });
    }, [method]);

    const fetchUserFinancialData = async () => {
        setLoading(true);
        try {
            // 1. Get user's current enrollments
            const { data: enrollments } = await supabase
                .from('enrollments')
                .select('id, program_id')
                .eq('user_id', selectedUser.id);
            setUserEnrollments(enrollments || []);

            // 2. Get ALL programs for the organization
            const { data: allPrograms, error: progError } = await supabase
                .from('programs')
                .select('id, name')
                .eq('organization_id', organization.id);

            if (progError) throw progError;

            if (!allPrograms || allPrograms.length === 0) {
                setSessions([{ label: 'No Programs Found', key: 'none:none', disabled: true }]);
                return;
            }

            // 3. Get ALL sessions for the organization
            const { data: allSessions } = await supabase
                .from('sessions')
                .select('id, name, session_date, program_id')
                .eq('organization_id', organization.id)
                .order('session_date', { ascending: true });

            // 4. Flatten into a selectable list
            const combined: any[] = [];
            for (const prog of allPrograms) {
                const isEnrolled = (enrollments || []).some(e => e.program_id === prog.id);
                
                // Add sessions for this program
                const progSessions = (allSessions || []).filter(s => s.program_id === prog.id);
                for (const s of progSessions) {
                    combined.push({
                        label: `${s.name} (${prog.name})`,
                        programId: prog.id,
                        sessionId: s.id,
                        key: `${prog.id}:${s.id}`
                    });
                }

                // Add general fee option
                combined.push({
                    label: `General Enrollment Fee (${prog.name})`,
                    programId: prog.id,
                    sessionId: 'none',
                    key: `${prog.id}:none`
                });
            }

            setSessions(combined.length > 0 ? combined : [{ label: 'No Sessions or Programs Found', key: 'none:none', disabled: true }]);
            if (combined.length > 0) {
                setSelectedSessionData((prev: string) => combined.find(c => c.key === prev) ? prev : combined[0].key);
            }
        } catch (err) {
            console.error('Error fetching financial data:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser || !organization || !profile) {
            alert('Error: Please re-open the window.');
            return;
        }
        if (!selectedSessionData || selectedSessionData === 'none' || selectedSessionData === 'none:none') {
            alert('Please select a program or session first.');
            return;
        }
        if (!receiptNumber.trim()) {
            alert('Please enter a receipt number.');
            return;
        }

        setLoading(true);

        try {
            const { sessionService } = await import('@/services/sessionService');
            const { programService } = await import('@/services/programService');
            const [programId, sessionId] = selectedSessionData.split(':');
            
            // 1. Resolve Enrollment (Create if missing)
            let enrollment = userEnrollments.find(e => e.program_id === programId);
            
            if (!enrollment) {
                const resp = await programService.enrollInProgram(
                    programId,
                    selectedUser.id,
                    organization.id,
                    'paid'
                );
                enrollment = { id: resp.id, program_id: programId };
            }

            let paymentRecord: any;

            if (sessionId !== 'none') {
                paymentRecord = await sessionService.recordSessionPayment(
                    sessionId,
                    selectedUser.id,
                    organization.id,
                    amount,
                    method,
                    profile.id,
                    'paid',
                    receiptNumber.trim()
                );
                if (!paymentRecord) throw new Error('Failed to record payment.');
                
                const { data: fullRecord } = await supabase
                    .from('payment_records')
                    .select('*, user:user_id(first_name, surname, email, profile_photo_url), program:program_id(name), session:session_id(name, session_date)')
                    .eq('id', paymentRecord.id)
                    .single();
                paymentRecord = fullRecord || paymentRecord;
            } else {
                // Record general program payment
                const { data, error } = await supabase
                    .from('payment_records')
                    .insert([{
                        organization_id: organization.id,
                        user_id: selectedUser.id,
                        enrollment_id: enrollment.id,
                        amount,
                        payment_method: method,
                        status: 'paid',
                        receipt_number: receiptNumber.trim(),
                        confirmed_by: profile.id,
                        confirmed_at: new Date().toISOString()
                    }])
                    .select('*, user:user_id(first_name, surname, email, profile_photo_url), program:program_id(name)')
                    .single();
                if (error) throw error;
                paymentRecord = data;
            }

            setLastPayment(paymentRecord);
            setShowSuccess(true);
            
            // Refresh parent list immediately
            const { data: updatedPayments } = await supabase
                .from('payment_records')
                .select('*, user:user_id(first_name, surname, email, profile_photo_url), program:program_id(name), session:session_id(name, session_date)')
                .eq('organization_id', organization.id)
                .order('created_at', { ascending: false });
            if (updatedPayments) onSuccess(updatedPayments);
            
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleContinue = async (clearUser = true) => {
        if (clearUser) {
            setSelectedUser(null);
            setSearch('');
            setUserEnrollments([]);
            setSessions([]);
        } else {
            // Keep user, but refresh their data
            if (selectedUser) fetchUserFinancialData();
        }
        
        setReceiptNumber(createSuggestedReceiptNumber(method));
        setShowSuccess(false);
        setLastPayment(null);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-2xl">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-surface border border-surface-border rounded-[32px] w-full max-w-lg p-10 shadow-2xl space-y-8"
            >
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">
                            {showSuccess ? 'Payment Saved' : 'Enter Payment'}
                        </h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">
                            {showSuccess ? 'The payment has been recorded successfully' : 'Record a payment for a participant'}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-foreground transition-colors"><XCircle className="w-8 h-8" /></button>
                </div>

                {showSuccess ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-8 py-4"
                    >
                        <div className="flex flex-col items-center justify-center p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-[24px] text-center">
                            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mb-4">
                                <Banknote className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="text-xl font-black text-foreground uppercase tracking-tight">Payment Recorded</h4>
                            <p className="text-xs font-bold text-slate-500 mt-2">
                                Receipt <strong>#{lastPayment?.receipt_number}</strong> has been created for {lastPayment?.user?.first_name}.
                            </p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button 
                                variant="premium" 
                                className="h-16 font-black uppercase tracking-widest text-[11px]"
                                onClick={() => {
                                    if (lastPayment) onOpenReceipt(lastPayment);
                                }}
                            >
                                <Printer className="w-4 h-4 mr-2" /> Print Official Receipt
                            </Button>
                            
                            <div className="grid grid-cols-2 gap-3 mt-2">
                                <Button 
                                    variant="outline"
                                    className="h-14 font-black uppercase tracking-widest text-[10px] bg-background border-surface-border text-slate-500 hover:text-foreground"
                                    onClick={() => handleContinue(false)}
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Another Session
                                </Button>
                                <Button 
                                    variant="outline"
                                    className="h-14 font-black uppercase tracking-widest text-[10px] bg-background border-surface-border text-slate-500 hover:text-foreground"
                                    onClick={() => handleContinue(true)}
                                >
                                    <User className="w-4 h-4 mr-2" /> New Participant
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* User Search */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Search for Participant</label>
                            {!selectedUser ? (
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        className="w-full h-14 bg-background border border-surface-border rounded-2xl pl-12 pr-6 text-sm font-bold text-foreground outline-none focus:bg-surface focus:border-primary/30 font-sans"
                                        placeholder="Search by name or email..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                    {loading && search.length > 2 && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                            <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">Searching...</span>
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                        </div>
                                    )}
                                    {search.length > 2 && (
                                        <div className="absolute top-16 left-0 right-0 bg-surface border border-surface-border rounded-2xl p-2 z-10 shadow-2xl space-y-1">
                                            {loading && users.length === 0 ? (
                                                <div className="p-4 text-center">
                                                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" />
                                                </div>
                                            ) : users.length > 0 ? (
                                                users.map(u => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        className="w-full text-left p-4 hover:bg-background rounded-xl transition-all text-sm font-bold text-foreground flex justify-between items-center group relative overflow-hidden"
                                                        onClick={() => setSelectedUser(u)}
                                                    >
                                                        <div className="relative z-10">
                                                            <div>{u.first_name} {u.surname}</div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{u.email}</div>
                                                                {u.phone_number && (
                                                                    <>
                                                                        <span className="w-1 h-1 bg-slate-400 rounded-full"></span>
                                                                        <div className="text-[10px] font-bold text-primary uppercase tracking-widest italic">{u.phone_number}</div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors relative z-10" />
                                                    </button>
                                                ))
                                            ) : !loading && (
                                                <div className="p-4 text-xs font-bold text-slate-500 text-center uppercase tracking-widest italic">
                                                    No one found matching "{search}"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex justify-between items-center p-4 bg-primary/10 border border-primary/20 rounded-2xl">
                                    <span className="font-black text-primary text-sm uppercase tracking-tight">{selectedUser.first_name} {selectedUser.surname}</span>
                                    <button type="button" onClick={() => setSelectedUser(null)} className="text-[10px] font-black uppercase text-primary underline underline-offset-4 hover:text-primary/70 transition-colors">Change Person</button>
                                </div>
                            )}
                        </div>

                    {/* Continuous Mode Toggle */}
                    <div className="flex items-center justify-between p-4 bg-background border border-surface-border rounded-2xl">
                        <div className="flex items-center gap-3">
                            <History className="w-4 h-4 text-slate-500" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Keep window open after saving</span>
                        </div>
                        <button 
                            type="button"
                            onClick={() => setContinuousMode(!continuousMode)}
                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${continuousMode ? 'bg-primary border-primary' : 'bg-background border-surface-border'}`}
                        >
                            <div className={`w-2 h-2 rounded-full ${continuousMode ? 'bg-white' : 'bg-slate-700'}`}></div>
                        </button>
                    </div>

                    {selectedUser && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">What is this payment for? (Session or Fee)</label>
                                    <select
                                        className="w-full h-14 bg-background border border-surface-border rounded-2xl px-6 text-sm font-bold text-foreground outline-none uppercase tracking-widest text-[10px] appearance-none cursor-pointer hover:bg-surface focus:border-primary/40 transition-all font-sans"
                                        value={selectedSessionData}
                                        onChange={e => setSelectedSessionData(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Select session or fee...</option>
                                        {sessions.map(s => (
                                            <option key={s.key} value={s.key} disabled={s.disabled}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Receipt Number</label>
                                    <input
                                        type="text"
                                        className="w-full h-14 bg-background border border-surface-border rounded-2xl px-6 text-sm font-bold text-foreground outline-none focus:bg-surface focus:border-primary/30 transition-all font-sans uppercase tracking-wider"
                                        value={receiptNumber}
                                        onChange={e => setReceiptNumber(e.target.value.toUpperCase())}
                                        placeholder="Enter receipt number"
                                        required
                                    />
                                </div>
                                
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Amount ($)</label>
                                    <input
                                        type="number"
                                        className="w-full h-14 bg-background border border-surface-border rounded-2xl px-6 text-sm font-bold text-foreground outline-none focus:bg-surface focus:border-primary/30 transition-all font-sans"
                                        value={amount}
                                        onChange={e => setAmount(Number(e.target.value))}
                                        step="0.01"
                                        placeholder="0.00"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Payment Method</label>
                                    <select
                                        className="w-full h-14 bg-background border border-surface-border rounded-2xl px-6 text-sm font-bold text-foreground outline-none font-black uppercase tracking-widest text-[10px] appearance-none cursor-pointer hover:bg-surface focus:border-primary/40 transition-all font-sans"
                                        value={method}
                                        onChange={e => setMethod(e.target.value)}
                                    >
                                        <option value="cash">💵 Cash</option>
                                        <option value="ecocash">📱 EcoCash</option>
                                        <option value="swipe">💳 Swipe / Card</option>
                                        <option value="bank_transfer">🏛️ Bank Transfer</option>
                                    </select>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                variant="premium"
                                className="w-full h-16 font-black uppercase tracking-widest text-xs"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : 'Save Payment'}
                            </Button>
                        </>
                    )}
                </form>
            )}
            </motion.div>
        </div>
    );
}
