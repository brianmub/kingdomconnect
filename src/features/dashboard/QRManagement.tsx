import { useState, useEffect } from 'react';
import { Card, GlassBox } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { QrCode as QrIcon, Maximize, RefreshCw, CheckCircle2, XCircle, Camera, Search, Loader2, Banknote } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { sessionService } from '@/services/sessionService';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { ReceiptModal } from '@/components/shared/ReceiptModal';
import { Session } from '@/types';
import { supabase } from '@/services/supabase';

export function QRManagement() {
    const [searchParams] = useSearchParams();
    const sessionId = searchParams.get('session');
    const mode = searchParams.get('mode');
    const { organization } = useOrganization();
    const { profile } = useAuth();

    const [view, setView] = useState<'generate' | 'scan'>(sessionId ? 'generate' : 'scan');
    const [scannedResult, setScannedResult] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    const [lastAction, setLastAction] = useState<'clock_in' | 'clock_out' | 'none' | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [attendance, setAttendance] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paymentRequired, setPaymentRequired] = useState<{ userId: string } | null>(null);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [participants, setParticipants] = useState<any[]>([]);
    const [isManualModalOpen, setIsManualModalOpen] = useState(mode === 'manual');
    const [latestPayment, setLatestPayment] = useState<any>(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    
    // Facilitator Specific State
    const [facilitatorGroups, setFacilitatorGroups] = useState<string[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (sessionId) {
            fetchSessionData();
            fetchParticipants();
        }
    }, [sessionId]);

    useEffect(() => {
        if (profile?.role === 'facilitator') {
            fetchFacilitatorGroups();
        }
    }, [profile]);

    const fetchFacilitatorGroups = async () => {
        const { data } = await supabase
            .from('program_groups')
            .select('id')
            .eq('facilitator_id', profile!.id);
        
        const ids = data?.map(g => g.id) || [];
        setFacilitatorGroups(ids);
        if (ids.length > 0) setSelectedGroupId(ids[0]);
    };

    const fetchParticipants = async () => {
        if (!sessionId) return;
        try {
            const { data: sess } = await supabase
                .from('sessions')
                .select('program_id')
                .eq('id', sessionId)
                .single();

            if (!sess) return;

            const { data: enrolls } = await supabase
                .from('enrollments')
                .select(`
                    user_id,
                    users!user_id (id, first_name, surname, profile_photo_url, email),
                    group_members:group_members!user_id (group_id)
                `)
                .eq('program_id', sess.program_id)
                .eq('status', 'active');

            const formatted = enrolls?.map((e: any) => ({
                ...e,
                group_id: e.group_members?.[0]?.group_id || null
            })) || [];

            setParticipants(formatted);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSessionData = async () => {
        try {
            setLoading(true);
            const { data: sess } = await supabase
                .from('sessions')
                .select('*')
                .eq('id', sessionId)
                .single();
            setSession(sess);

            const att = await sessionService.getAttendanceForSession(sessionId!);
            setAttendance(att);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const isUserAttended = (userId: string) => attendance.find(a => a.user_id === userId);

    useEffect(() => {
        let scanner: Html5QrcodeScanner | null = null;

        if (view === 'scan') {
            const initScanner = () => {
                const element = document.getElementById("reader");
                if (!element) {
                    requestAnimationFrame(initScanner);
                    return;
                }

                scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    false
                );

                scanner.render(async (decodedText) => {
                    setScannedResult(decodedText);
                    await handleAttendanceCheck(decodedText);
                    scanner?.clear();
                }, (error) => {
                    // silent scan error
                });
            };

            const timer = setTimeout(initScanner, 100);

            return () => {
                clearTimeout(timer);
                if (scanner) {
                    scanner.clear().catch(console.error);
                }
            };
        }
    }, [view]);

    const handleAttendanceCheck = async (data: string) => {
        if (!organization?.id || !sessionId) {
            setIsSuccess(false);
            return;
        }

        try {
            setLoading(true);
            const cleanData = data.startsWith('user-') ? data.replace('user-', '') : data;

            const response = await sessionService.markAttendance(sessionId, cleanData, organization.id);
            setIsSuccess(true);
            setLastAction(response.action as any);
            fetchSessionData();
        } catch (err: any) {
            if (err.message === 'PAYMENT_REQUIRED') {
                setPaymentRequired({ userId: data.startsWith('user-') ? data.replace('user-', '') : data });
            }
            setIsSuccess(false);
            setLastAction(null);
        } finally {
            setLoading(false);
            setTimeout(() => {
                setScannedResult(null);
                setIsSuccess(null);
                setLastAction(null);
            }, 3000);
        }
    };

    const filteredParticipants = participants.filter(p => {
        const matchesGroup = selectedGroupId === 'all' || p.group_id === selectedGroupId;
        const matchesSearch = searchQuery === '' || 
            `${p.users.first_name} ${p.users.surname}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.users.email?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesGroup && matchesSearch;
    });

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight uppercase italic">Digital <span className="text-primary">Terminal</span></h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Multi-vector verification protocol</p>
                </div>
                <div className="flex bg-surface p-1.5 rounded-2xl border border-surface-border">
                    <button
                        onClick={() => setView('generate')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'generate' ? 'bg-gradient-premium text-white shadow-xl' : 'text-slate-500 hover:text-foreground'}`}
                    >
                        Master QR
                    </button>
                    <button
                        onClick={() => setView('scan')}
                        className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'scan' ? 'bg-gradient-premium text-white shadow-xl' : 'text-slate-500 hover:text-foreground'}`}
                    >
                        Sensor Mode
                    </button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12">
                <Card className="flex flex-col items-center justify-center p-12 min-h-[550px] bg-surface border-surface-border relative overflow-hidden group shadow-2xl">
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                    {view === 'generate' ? (
                        <div className="text-center space-y-10 w-full relative z-10">
                            {session ? (
                                <>
                                    <div className="relative inline-block">
                                        <div className="absolute inset-0 bg-primary/20 blur-[100px] rounded-full animate-pulse"></div>
                                        <div className="relative bg-white p-10 rounded-[40px] shadow-2xl border border-primary/20">
                                            <QRCodeSVG
                                                value={session.qr_code_data}
                                                size={240}
                                                level="H"
                                                includeMargin={true}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">{session.name}</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest max-w-xs mx-auto mb-10 leading-relaxed">
                                            Transmit this credential to participants for immediate encrypted field validation.
                                        </p>
                                        <div className="flex gap-4 justify-center">
                                            <Button variant="outline" className="h-12 bg-background border-surface-border text-[10px] font-black uppercase tracking-widest">
                                                <Maximize className="w-4 h-4 mr-3 text-primary" /> Expansion
                                            </Button>
                                            <Button variant="outline" className="h-12 bg-background border-surface-border text-[10px] font-black uppercase tracking-widest" onClick={fetchSessionData}>
                                                <RefreshCw className="w-4 h-4 mr-3 text-primary" /> Sync
                                            </Button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="text-slate-600 font-black uppercase tracking-widest text-[10px] flex items-center gap-3">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" /> Initializing Session Feed...
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center relative z-10">
                            {scannedResult ? (
                                <div className="flex flex-col items-center justify-center transition-all duration-500 py-10">
                                    {isSuccess ? (
                                        <div className="text-center space-y-8">
                                            <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto border shadow-2xl transition-colors ${lastAction === 'clock_out' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/20'}`}>
                                                <CheckCircle2 className="w-16 h-16" />
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black text-foreground uppercase tracking-tight">
                                                    {lastAction === 'clock_out' ? 'Departure Confirmed' : 'Entry Validated'}
                                                </h3>
                                                <p className={`font-black uppercase tracking-widest text-[10px] mt-2 ${lastAction === 'clock_out' ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                    System synchronized with central ledger
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-8">
                                            <div className="w-32 h-32 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/20 shadow-2xl shadow-rose-500/20">
                                                <XCircle className="w-16 h-16" />
                                            </div>
                                            <div>
                                                <h3 className="text-3xl font-black text-foreground uppercase tracking-tight">
                                                    {paymentRequired ? 'Financial Block' : 'Analysis Failed'}
                                                </h3>
                                                <p className="text-rose-400 font-black uppercase tracking-widest text-[10px] mt-2">
                                                    {paymentRequired ? 'Requires Session Fee Tender' : 'Invalid or Unknown Credential Syntax'}
                                                </p>

                                                {paymentRequired && (
                                                    <Button variant="premium" className="mt-8 h-12 uppercase font-black tracking-widest text-[10px]" onClick={() => setIsProcessingPayment(true)}>
                                                        <Banknote className="w-4 h-4 mr-2" /> Tender {session?.currency || 'USD'} {(Number(session?.session_fee) || 0).toFixed(2)}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full space-y-10">
                                    <div id="reader" className="w-full rounded-3xl overflow-hidden border border-surface-border bg-background/50 aspect-square flex items-center justify-center relative shadow-inner">
                                        <div className="absolute inset-0 border-[20px] border-surface opacity-10 pointer-events-none"></div>
                                        <div className="text-center">
                                            <Camera className="w-12 h-12 text-slate-700 mx-auto mb-4 opacity-20" />
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Activating Optical Sensor...</p>
                                        </div>
                                    </div>
                                    <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10">
                                        <p className="text-[9px] text-indigo-400 font-black uppercase tracking-widest leading-relaxed">
                                            FIELD ADVISORY: Target the participant digital ID. Real-time extraction 
                                            and cross-referencing against the roster will execute automatically.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                <div className="space-y-12">
                    <Card className="bg-gradient-premium border-none text-white overflow-hidden p-10 shadow-2xl relative group">
                        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <QrIcon className="w-40 h-40" />
                        </div>
                        <div className="relative z-10 flex items-center justify-between mb-10">
                            <h3 className="text-lg font-black uppercase tracking-[0.2em]">Session Intelligence</h3>
                            <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest border border-white/20">Real-time Stream</span>
                        </div>
                        <div className="relative z-10 space-y-10">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-6xl font-black tracking-tighter leading-none">{attendance.length}</p>
                                    <p className="text-[10px] font-black uppercase text-white/60 tracking-widest mt-4">Verified Field Entries</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black tracking-tight">{session?.max_capacity ? Math.round((attendance.length / session.max_capacity) * 100) : '--'}%</p>
                                    <p className="text-[10px] font-black uppercase text-white/60 tracking-widest mt-1">Saturation Level</p>
                                </div>
                            </div>
                            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden border border-white/5 p-0.5 shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: session?.max_capacity ? `${(attendance.length / session.max_capacity) * 100}%` : '50%' }}
                                    className="h-full bg-white rounded-full shadow-[0_0_20px_rgba(255,255,255,0.8)]"
                                ></motion.div>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-10 bg-surface border-surface-border shadow-xl">
                        <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.2em] mb-10 flex items-center gap-2">
                             Activity Audit <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                        </h3>
                        <div className="space-y-8">
                            {attendance.length > 0 ? attendance.slice(0, 4).map((att) => (
                                <div key={att.id} className="flex items-center justify-between group">
                                    <div className="flex items-center space-x-5">
                                        <div className="w-12 h-12 bg-background rounded-2xl flex items-center justify-center font-black text-primary border border-surface-border overflow-hidden shadow-inner">
                                            {att.users.profile_photo_url ? (
                                                <img src={att.users.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                att.users.first_name[0] + att.users.surname[0]
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-foreground uppercase tracking-tight">{att.users.first_name} {att.users.surname}</p>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1 italic">
                                                Checked-in at {new Date(att.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-10 opacity-30 italic text-[10px] font-black uppercase tracking-[0.3em]">
                                    No records found
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            className="w-full mt-12 h-14 bg-background text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-foreground border border-transparent hover:border-surface-border transition-all"
                            onClick={() => setIsManualModalOpen(true)}
                        >
                            <Search className="w-4 h-4 mr-3" /> Manual Override Roster
                        </Button>
                    </Card>
                </div>
            </div>

            {/* Manual Override Modal */}
            {isManualModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xl p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-surface border border-surface-border rounded-[40px] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
                    >
                        <div className="p-10 border-b border-surface-border flex flex-col gap-6 bg-background/50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight italic">Manual <span className="text-primary">Registry</span></h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 leading-relaxed opacity-60">Verified bypass for authenticated personnel</p>
                                </div>
                                <Button variant="ghost" className="p-4 rounded-2xl hover:bg-background" onClick={() => setIsManualModalOpen(false)}>
                                    <XCircle className="w-8 h-8 text-slate-500" />
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-4">
                                <div className="flex-1 min-w-[200px] relative">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Identify participant..."
                                        className="w-full h-14 bg-background border border-surface-border rounded-2xl pl-12 pr-6 text-sm font-bold text-foreground outline-none focus:border-primary/40 transition-all font-black uppercase tracking-widest placeholder:text-slate-700"
                                    />
                                </div>
                                {(profile?.role === 'facilitator' || profile?.role?.includes('admin')) && (
                                    <Button 
                                        variant="outline" 
                                        className="h-14 px-8 text-[11px] font-black uppercase tracking-[0.2em] border-primary/20 text-primary hover:bg-primary/5 transition-all shadow-xl"
                                        onClick={async () => {
                                            if (window.confirm('Execute bulk verification for all present enrollees?')) {
                                                await sessionService.bulkVerifyAttendance(sessionId!, profile!.id);
                                                fetchSessionData();
                                            }
                                        }}
                                    >
                                        Bulk Valid
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 space-y-6">
                            {filteredParticipants.map((p) => {
                                const userItem = p.users;
                                const attRecord = isUserAttended(userItem.id);
                                const attended = !!attRecord;
                                const verified = attRecord?.is_verified;

                                return (
                                    <div key={userItem.id} className="bg-background border border-surface-border rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 group hover:border-primary/20 transition-all shadow-lg hover:shadow-primary/5">
                                        <div className="flex items-center gap-6 w-full md:w-auto">
                                            <div className="w-16 h-16 rounded-2xl bg-surface flex items-center justify-center font-black text-lg text-primary border border-surface-border overflow-hidden shadow-inner">
                                                {userItem.profile_photo_url ? (
                                                    <img src={userItem.profile_photo_url} alt="" className="w-full h-full object-cover" />
                                                ) : (
                                                    userItem.first_name[0] + userItem.surname[0]
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-lg font-black text-foreground uppercase tracking-tight truncate">{userItem.first_name} {userItem.surname}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-lg border ${attended ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                                                        {attended ? (verified ? 'VERIFIED' : 'PENDING ADVISORY') : 'ABSENT'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-3 w-full md:w-auto">
                                            {session?.is_paid && (Number(session?.session_fee) || 0) > 0 && (
                                                <Button
                                                    variant="outline"
                                                    className="h-12 flex-1 md:flex-none px-6 text-[10px] font-black uppercase tracking-widest bg-emerald-500/5 text-emerald-600 border-emerald-500/10 hover:bg-emerald-500/10 transition-all"
                                                    onClick={() => {
                                                        setPaymentRequired({ userId: userItem.id });
                                                        setIsProcessingPayment(true);
                                                    }}
                                                >
                                                    <Banknote className="w-4 h-4 mr-2" /> Fee
                                                </Button>
                                            )}
                                            <Button
                                                variant="premium"
                                                className="h-12 flex-1 md:flex-none px-8 text-[10px] font-black uppercase tracking-widest shadow-xl"
                                                disabled={attended && verified}
                                                onClick={() => {
                                                    if (!attended) handleAttendanceCheck(`user-${userItem.id}`);
                                                    else if (!verified) {
                                                        sessionService.verifyAttendance(attRecord.id, profile!.id).then(() => fetchSessionData());
                                                    }
                                                }}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" /> {attended ? (verified ? 'VALID' : 'VERIFY') : 'CHECK-IN'}
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}

                            {filteredParticipants.length === 0 && (
                                <div className="text-center py-24 bg-background/50 rounded-[40px] border border-dashed border-surface-border opacity-40">
                                    <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.4em]">No Active Parameters Found</p>
                                </div>
                            )}
                        </div>

                        <div className="p-10 border-t border-surface-border bg-background/50">
                            <Button variant="ghost" className="w-full text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] p-6 hover:text-foreground transition-all" onClick={() => setIsManualModalOpen(false)}>
                                TERMINATE BYPASS MODE
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Payment Modal */}
            {isProcessingPayment && paymentRequired && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl p-4">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-surface border border-surface-border rounded-[48px] w-full max-w-sm p-12 shadow-2xl text-center"
                    >
                        <div className="mx-auto w-24 h-24 bg-primary/10 rounded-[32px] flex items-center justify-center mb-10 border border-primary/20">
                            <Banknote className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-3xl font-black text-foreground uppercase tracking-tight mb-4 italic">Ledger Sync</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-10 opacity-60">Manual financial override required</p>

                        <div className="bg-background rounded-3xl p-8 mb-10 border border-surface-border shadow-inner">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Tender Amount</p>
                            <p className="text-6xl font-black text-foreground tracking-tighter">{session?.currency === 'USD' ? '$' : (session?.currency || '$')}{(Number(session?.session_fee) || 0).toFixed(2)}</p>
                        </div>

                        <div className="space-y-4">
                            <Button
                                variant="premium"
                                className="w-full h-16 uppercase font-black tracking-[0.2em] text-xs shadow-2xl"
                                onClick={async () => {
                                    try {
                                        const feeAmount = Number(session?.session_fee) || 0;
                                        const p = await sessionService.recordSessionPayment(
                                            sessionId!,
                                            paymentRequired.userId,
                                            organization!.id,
                                            feeAmount,
                                            session?.payment_method || 'cash',
                                            profile!.id,
                                            'paid'
                                        );
                                        setLatestPayment(p);
                                        setIsReceiptModalOpen(true);
                                        setIsProcessingPayment(false);
                                        setPaymentRequired(null);
                                        fetchParticipants();
                                    } catch (err) { console.error(err); }
                                }}
                            >
                                EXECUTE TENDER
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-16 w-full text-slate-500 uppercase font-black tracking-[0.2em] text-xs hover:text-foreground"
                                onClick={() => {
                                    setIsProcessingPayment(false);
                                    setPaymentRequired(null);
                                    setScannedResult(null);
                                }}
                            >
                                ABORT
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}

            {isReceiptModalOpen && latestPayment && (
                <ReceiptModal
                    isOpen={isReceiptModalOpen}
                    onClose={() => setIsReceiptModalOpen(false)}
                    payment={latestPayment}
                    organization={organization}
                />
            )}
        </div>
    );
}
