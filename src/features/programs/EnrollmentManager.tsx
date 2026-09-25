import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useOrganization } from '@/hooks/useOrganization';
import { useParams } from 'react-router-dom';
import { Loader2, Search, Filter, CheckCircle2, XCircle, Banknote, MoreVertical, Printer, History, Users, RefreshCw, UserPlus, ShieldCheck, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { motion, AnimatePresence } from 'framer-motion';
import { ReceiptModal } from '@/components/shared/ReceiptModal';
import { useAuth } from '@/hooks/useAuth';

interface Participant {
    id: string;
    first_name: string;
    surname: string;
    email: string;
    role: string;
    dob?: string;
    church_name?: string;
    residential_address?: string;
    enrollments: any[];
}

export function EnrollmentManager() {
    const { organization } = useOrganization();
    const { profile } = useAuth();
    const { orgSlug } = useParams();

    const [participants, setParticipants] = useState<Participant[]>([]);
    const [programs, setPrograms] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [enrollUser, setEnrollUser] = useState<Participant | null>(null);
    const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);
    const [latestPayment, setLatestPayment] = useState<any>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [payments, setPayments] = useState<any[]>([]);

    useEffect(() => {
        if (organization?.id) {
            fetchData();
        }
    }, [organization?.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users, enrollments, and programs in parallel
            const [usersRes, enrollRes, progRes] = await Promise.all([
                supabase
                    .from('users')
                    .select('id, first_name, surname, email, role, dob, church_name, residential_address')
                    .eq('organization_id', organization!.id),
                supabase
                    .from('enrollments')
                    .select(`
                        *,
                        program:programs (id, name)
                    `)
                    .eq('organization_id', organization!.id),
                supabase
                    .from('programs')
                    .select('id, name')
                    .eq('organization_id', organization!.id)
            ]);

            if (usersRes.error) throw usersRes.error;
            if (enrollRes.error) throw enrollRes.error;

            const usersData = usersRes.data || [];
            const enrollData = enrollRes.data || [];
            setPrograms(progRes.data || []);

            // 4. Merge Data
            const merged = (usersData || []).map(user => ({
                ...user,
                enrollments: (enrollData || []).filter(e => e.user_id === user.id)
            }));

            // Prioritize those who ARE enrolled
            const sorted = merged.sort((a, b) => {
                const aVal = a.enrollments.length > 0 ? 0 : 1;
                const bVal = b.enrollments.length > 0 ? 0 : 1;
                return aVal - bVal;
            });

            setParticipants(sorted);
        } catch (err) {
            console.error('Error fetching participant data:', err);
        } finally {
            setLoading(false);
        }
    };

    const calculateAge = (dob: string | null | undefined) => {
        if (!dob) return null;
        try {
            const birthDate = new Date(dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            return age;
        } catch (e) {
            return null;
        }
    };

    const fetchPaymentHistory = async (enrollmentId: string) => {
        const { data } = await supabase
            .from('payment_records')
            .select('*')
            .eq('enrollment_id', enrollmentId)
            .order('created_at', { ascending: false });
        setPayments(data || []);
    };

    const filtered = participants.filter(p => {
        const name = `${p.first_name} ${p.surname}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase()) ||
            p.email?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    if (!organization) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <Users className="w-16 h-16 text-slate-600 mb-4 opacity-50" />
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Organization Not Selected</h3>
                <p className="text-slate-500 text-xs mt-2 max-w-xs">Please select your organization from your profile.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h2 className="text-2xl font-black text-foreground uppercase tracking-tight">Participant List</h2>
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mt-1">Status and enrollment for all {participants.length} members</p>
                </div>
                <div className="flex gap-4">
                    <Button
                        variant="ghost"
                        className="h-10 px-4 text-slate-500 hover:text-primary transition-colors"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            <Card className="p-6 border-surface-border bg-surface shadow-xl">
                <div className="flex gap-4 mb-8">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Find a participant..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-14 bg-background border border-surface-border rounded-xl pl-12 pr-4 text-foreground font-bold text-sm outline-none focus:border-primary/40 transition-all shadow-inner font-sans"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-surface-border">
                                    <th className="text-left py-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Participant</th>
                                    <th className="text-left py-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Biodata</th>
                                    <th className="text-left py-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Programs</th>
                                    <th className="text-center py-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Role</th>
                                    <th className="text-right py-4 px-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((p) => (
                                    <tr key={p.id} className="border-b border-surface-border/50 hover:bg-primary/5 transition-colors group">
                                        <td className="py-4 px-2">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-[14px] shadow-sm ${p.enrollments.length > 0 ? 'bg-primary/10 text-primary' : 'bg-slate-500/10 text-slate-400'
                                                    }`}>
                                                    {(p.first_name?.[0] || '?') + (p.surname?.[0] || '?')}
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-black text-foreground uppercase tracking-tight leading-none mb-1">{p.first_name} {p.surname}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{p.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-foreground uppercase tracking-widest">
                                                        {calculateAge(p.dob) !== null ? `Age: ${calculateAge(p.dob)}` : 'Age: N/A'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">
                                                        • {p.church_name || 'No Church'}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.1em] max-w-[140px] truncate" title={p.residential_address}>
                                                    {p.residential_address || 'Address N/A'}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="py-4 px-2">
                                            {p.enrollments.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {p.enrollments.map(e => (
                                                        <div key={e.id} className="flex items-center gap-2">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                            <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{e.program?.name}</span>
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${e.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                                                }`}>
                                                                {e.payment_status}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <HelpCircle className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest italic opacity-60">Not Enrolled</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-2 text-center">
                                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-1.5 ${p.role === 'system_admin' ? 'bg-rose-500/10 text-rose-400' :
                                                p.role === 'program_admin' ? 'bg-primary/10 text-primary' :
                                                    'bg-slate-500/10 text-slate-400'
                                                }`}>
                                                {p.role === 'system_admin' && <ShieldCheck className="w-3 h-3" />}
                                                {p.role.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="py-4 px-2 text-right">
                                            <div className="flex justify-end items-center gap-1">
                                                {p.enrollments.length > 0 ? (
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-10 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-primary transition-all"
                                                            onClick={() => {
                                                                const e = p.enrollments[0];
                                                                setSelectedEnrollment(e);
                                                                fetchPaymentHistory(e.id);
                                                                setIsHistoryOpen(true);
                                                            }}
                                                        >
                                                            <History className="w-4 h-4 mr-2" /> History
                                                        </Button>
                                                        <div className="w-px h-6 bg-surface-border mx-1" />
                                                        <Button
                                                            variant="ghost"
                                                            className="h-10 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 transition-all"
                                                            onClick={() => setSelectedEnrollment(p.enrollments[0])}
                                                        >
                                                            <Banknote className="w-4 h-4 mr-2" /> Payments
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="united"
                                                        className="h-10 px-4 text-[9px] font-black uppercase tracking-widest"
                                                        onClick={() => setEnrollUser(p)}
                                                    >
                                                        <UserPlus className="w-4 h-4 mr-2" /> Enroll Now
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>

            {enrollUser && (
                <EnrollUserModal
                    user={enrollUser}
                    programs={programs}
                    onClose={() => setEnrollUser(null)}
                    onSuccess={() => {
                        setEnrollUser(null);
                        fetchData();
                    }}
                />
            )}

            {selectedEnrollment && !isHistoryOpen && (
                <ReceivePaymentModal
                    enrollment={selectedEnrollment}
                    profile={profile}
                    onClose={() => setSelectedEnrollment(null)}
                    onSuccess={(payment) => {
                        setSelectedEnrollment(null);
                        setLatestPayment(payment);
                        setIsReceiptModalOpen(true);
                        fetchData();
                    }}
                />
            )}

            {isReceiptModalOpen && latestPayment && (
                <ReceiptModal
                    isOpen={isReceiptModalOpen}
                    onClose={() => setIsReceiptModalOpen(false)}
                    payment={latestPayment}
                    organization={organization}
                />
            )}

            {isHistoryOpen && selectedEnrollment && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-surface border border-surface-border rounded-2xl w-full max-w-lg p-8 shadow-2xl relative flex flex-col"
                    >
                        <div className="flex justify-between items-center mb-8 shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none mb-1">Payment History</h3>
                                <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{selectedEnrollment.user?.first_name || 'Participant'}</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="text-slate-500 hover:text-foreground"><XCircle className="w-6 h-6" /></button>
                        </div>
                        <div className="flex-1 space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                            {payments.length > 0 ? payments.map((p) => (
                                <div key={p.id} className="bg-background border border-surface-border rounded-xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{new Date(p.created_at).toLocaleDateString()}</p>
                                        <p className="text-sm font-black text-foreground uppercase">{p.payment_method}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-emerald-400">+${p.amount.toFixed(2)}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center py-10 text-slate-500 text-[10px] font-black uppercase tracking-widest">No history found</p>
                            )}
                        </div>
                        <Button variant="ghost" className="w-full mt-6 uppercase font-black" onClick={() => setIsHistoryOpen(false)}>Done</Button>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// ─── Enroll User Modal ──────────────────────────────────────────────────────
function EnrollUserModal({ user, programs, onClose, onSuccess }: { user: Participant, programs: any[], onClose: () => void, onSuccess: () => void }) {
    const { organization } = useOrganization();
    const { profile, user: currentUser } = useAuth();
    const [programId, setProgramId] = useState(programs[0]?.id || '');
    const [due, setDue] = useState(10);
    const [paid, setPaid] = useState(0);
    const [loading, setLoading] = useState(false);

    const handleEnroll = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const targetOrgId = organization?.id || profile?.organization_id;
            const enrolledById = profile?.id || currentUser?.id;
            if (!targetOrgId || !enrolledById) {
                alert('Missing organization or user context. Please refresh and try again.');
                setLoading(false);
                return;
            }

            const { error } = await supabase
                .from('enrollments')
                .insert([{
                    organization_id: targetOrgId,
                    user_id: user.id,
                    program_id: programId,
                    amount_due: due,
                    amount_paid: paid,
                    payment_status: paid >= due ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'),
                    status: 'active',
                    enrolled_by: enrolledById
                }]);

            if (error) throw error;
            onSuccess();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="bg-surface border border-surface-border rounded-3xl w-full max-w-md p-10 shadow-2xl">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-foreground uppercase">{user.first_name} {user.surname}</h2>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mt-1">Add to Program</p>
                </div>
                <form onSubmit={handleEnroll} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Select Program</label>
                        <select value={programId} onChange={e => setProgramId(e.target.value)} className="w-full h-14 bg-background border border-surface-border rounded-xl px-4 font-bold font-sans">
                            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Enrollment Fee ($)</label>
                            <input type="number" value={due} onChange={e => setDue(Number(e.target.value))} className="w-full h-14 bg-background border border-surface-border rounded-xl px-4 font-bold font-sans" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase mb-2">Initial Amount Paid ($)</label>
                            <input type="number" value={paid} onChange={e => setPaid(Number(e.target.value))} className="w-full h-14 bg-background border border-surface-border rounded-xl px-4 font-bold font-sans" />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <Button variant="ghost" type="button" onClick={onClose} className="flex-1 font-black">Cancel</Button>
                        <Button type="submit" variant="united" className="flex-1 font-black h-14" disabled={loading}>{loading ? '...' : 'Confirm'}</Button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

// ─── Receive Payment Modal ────────────────────────────────────────────────────
function ReceivePaymentModal({ enrollment, profile, onClose, onSuccess }: { enrollment: any, profile: any, onClose: () => void, onSuccess: (payment: any) => void }) {
    const { organization } = useOrganization();
    const [amount, setAmount] = useState(enrollment.amount_due - enrollment.amount_paid);
    const [method, setMethod] = useState('cash');
    const [manualReceiptNumber, setManualReceiptNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const receiptNo = manualReceiptNumber.trim() || `REC-${Date.now().toString().slice(-6)}`;
            const targetOrgId = organization?.id || profile?.organization_id || enrollment?.organization_id;
            const processorId = profile?.id || enrollment?.user_id;

            if (!targetOrgId || !processorId) {
                alert('Missing organization or user profile context. Please refresh and try again.');
                setLoading(false);
                return;
            }

            const { data: paymentData, error: payError } = await supabase
                .from('payment_records')
                .insert([{
                    organization_id: targetOrgId,
                    user_id: enrollment.user_id,
                    enrollment_id: enrollment.id,
                    amount: amount,
                    payment_method: method,
                    status: 'paid',
                    processed_by: processorId,
                    receipt_number: receiptNo,
                    confirmed_by: processorId,
                    confirmed_at: new Date().toISOString()
                }])
                .select(`*, user:users(title, first_name, surname), program:programs(name)`)
                .single();

            if (payError) throw payError;

            const newPaid = enrollment.amount_paid + amount;
            await supabase.from('enrollments').update({
                amount_paid: newPaid,
                payment_status: newPaid >= enrollment.amount_due ? 'paid' : 'partial'
            }).eq('id', enrollment.id);

            onSuccess(paymentData);
        } catch (err: any) { alert(err.message); }
        finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
            <div className="bg-surface border border-surface-border rounded-2xl w-full max-w-md p-8 shadow-2xl">
                <h3 className="text-xl font-black mb-6 uppercase text-foreground">Record Payment: {enrollment.program?.name}</h3>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Amount to Pay ($)</label>
                        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="w-full h-14 bg-background border border-surface-border rounded-xl px-4 font-black text-lg focus:border-primary/40 outline-none font-sans" />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Receipt Number (Optional)</label>
                        <input 
                            type="text" 
                            placeholder="Leave blank to auto-generate"
                            value={manualReceiptNumber} 
                            onChange={e => setManualReceiptNumber(e.target.value)} 
                            className="w-full h-14 bg-background border border-surface-border rounded-xl px-4 font-bold text-sm focus:border-primary/40 outline-none font-sans" 
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Payment Method</label>
                        <select value={method} onChange={e => setMethod(e.target.value)} className="w-full h-14 bg-background border border-surface-border rounded-xl px-4 font-bold font-sans">
                            <option value="cash">Cash</option>
                            <option value="swipe">Swipe</option>
                            <option value="mobile_money">Mobile Money</option>
                        </select>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <Button variant="ghost" type="button" onClick={onClose} className="flex-1 font-bold">Cancel</Button>
                        <Button type="submit" variant="premium" className="flex-1 h-14 font-black" disabled={loading}>Confirm</Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

  
