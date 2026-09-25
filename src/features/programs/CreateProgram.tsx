import { useState } from 'react';
import { Card, GlassBox } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ArrowLeft, Save, Globe, Lock, ShieldCheck, DollarSign, Sparkles, BookOpen, Layers, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { programService } from '@/services/programService';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';

export function CreateProgram() {
    const navigate = useNavigate();
    const { organization, loading: orgLoading } = useOrganization();
    const { user, profile, profiles, loading: authLoading } = useAuth();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const isLoading = orgLoading || authLoading;

    const [formData, setFormData] = useState({
        name: '',
        category: 'Foundations',
        description: '',
        enrollment_fee: 0,
        session_fee: 0,
        qr_checkin_required: true,
        approval_required: false,
        max_participants: 0,
        enrollment_start_date: new Date().toISOString().split('T')[0],
        enrollment_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 30 days
    });

    const handleSave = async () => {
        const orgId = organization?.id || profile?.organization_id || profiles?.[0]?.organization_id;
        const creatorId = profile?.id || user?.id;

        if (!orgId || !creatorId) {
            console.error('Missing context:', { orgId, creatorId, organization, profile, user });
            setError('System Error: Missing organization or profile context. Please reload.');
            return;
        }

        if (!formData.name.trim()) {
            setError('Program name is required.');
            return;
        }

        try {
            setSaving(true);
            setError(null);

            // Construct payload with ONLY valid columns
            const programPayload = {
                organization_id: orgId,
                created_by: creatorId,
                name: formData.name,
                category: formData.category,
                description: formData.description,
                status: 'active' as 'active',
                start_date: new Date().toISOString().split('T')[0], // Default to today
                enrollment_fee: formData.enrollment_fee,
                session_fee: formData.session_fee,
                max_participants: formData.max_participants,
                currency: 'USD',
                attendance_required_pct: 80,
                enrollment_start_date: formData.enrollment_start_date,
                enrollment_end_date: formData.enrollment_end_date,
                // Nested features (this is where these toggles belong)
                features: {
                    certificates_enabled: true,
                    badges_enabled: true,
                    qr_checkin_required: formData.qr_checkin_required,
                    payment_required: formData.enrollment_fee > 0,
                    rsvp_enabled: true,
                    approval_required: formData.approval_required,
                }
            };

            await programService.createProgram(programPayload);

            navigate('/dashboard/programs');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-32">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center space-x-6">
                    <button
                        onClick={() => navigate('/dashboard/programs')}
                        className="w-14 h-14 bg-background hover:bg-surface border border-surface-border rounded-2xl flex items-center justify-center transition-all group"
                    >
                        <ArrowLeft className="w-6 h-6 text-slate-400 group-hover:text-foreground transition-colors" />
                    </button>
                    <div>
                        <div className="flex items-center space-x-2 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Curriculum Architect</span>
                        </div>
                        <h1 className="text-4xl font-black text-foreground tracking-tight uppercase">Program Creation</h1>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="h-14 px-8 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-foreground" onClick={() => navigate('/dashboard/programs')}>
                        Discard
                    </Button>
                    <Button variant="premium" className="h-14 px-10 text-[11px] font-black uppercase tracking-widest" onClick={handleSave} disabled={saving || isLoading}>
                        {saving || isLoading ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <Save className="w-4 h-4 mr-3" />}
                        Save
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-bold uppercase tracking-widest">
                    Error saving program: {error}
                </div>
            )}

            <div className="grid lg:grid-cols-3 gap-10">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-10">
                    <GlassBox className="p-10 border-surface-border bg-surface">
                        <div className="flex items-center space-x-4 mb-10">
                            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
                                <BookOpen className="w-6 h-6 text-primary" />
                            </div>
                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Essential Information</h3>
                        </div>
                        <div className="space-y-8">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Program Designation</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Apostolic Foundations & Doctrine"
                                    className="w-full px-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:bg-surface focus:border-primary/30 outline-none transition-all font-bold"
                                />
                            </div>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Ministry Category</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground focus:bg-surface focus:border-primary/30 outline-none transition-all font-bold appearance-none"
                                    >
                                        <option className="text-foreground bg-surface">Foundations</option>
                                        <option className="text-foreground bg-surface">Leadership</option>
                                        <option className="text-foreground bg-surface">Bible Study</option>
                                        <option className="text-foreground bg-surface">Youth</option>
                                        <option className="text-foreground bg-surface">Marriage & Family</option>
                                    </select>
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Max Capacity</label>
                                    <input
                                        type="number"
                                        placeholder="0 indicates Unlimited"
                                        value={formData.max_participants}
                                        onChange={(e) => setFormData({ ...formData, max_participants: parseInt(e.target.value) || 0 })}
                                        className="w-full px-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:bg-surface focus:border-primary/30 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Enrollment Starts</label>
                                    <input
                                        type="date"
                                        value={formData.enrollment_start_date}
                                        onChange={(e) => setFormData({ ...formData, enrollment_start_date: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground focus:bg-surface focus:border-primary/30 outline-none transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Enrollment Ends</label>
                                    <input
                                        type="date"
                                        value={formData.enrollment_end_date}
                                        onChange={(e) => setFormData({ ...formData, enrollment_end_date: e.target.value })}
                                        className="w-full px-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground focus:bg-surface focus:border-primary/30 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Program Overview</label>
                                <textarea
                                    rows={5}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Provide a comprehensive overview of the program objectives..."
                                    className="w-full px-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:bg-surface focus:border-primary/30 outline-none transition-all font-bold resize-none"
                                ></textarea>
                            </div>
                        </div>
                    </GlassBox>

                    <GlassBox className="p-10 border-surface-border bg-surface">
                        <div className="flex items-center space-x-4 mb-10">
                            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center border border-accent/20">
                                <DollarSign className="w-6 h-6 text-accent" />
                            </div>
                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Economic Configuration</h3>
                        </div>
                        <div className="grid md:grid-cols-2 gap-10">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Entry Threshold (USD)</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                                    <input
                                        type="number"
                                        value={formData.enrollment_fee}
                                        onChange={(e) => setFormData({ ...formData, enrollment_fee: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-14 pr-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground focus:bg-surface focus:border-accent/30 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Unit Session Val (USD)</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                                    <input
                                        type="number"
                                        value={formData.session_fee}
                                        onChange={(e) => setFormData({ ...formData, session_fee: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-14 pr-6 py-4 rounded-2xl border border-surface-border bg-background text-foreground focus:bg-surface focus:border-accent/30 outline-none transition-all font-bold"
                                    />
                                </div>
                            </div>
                        </div>
                    </GlassBox>
                </div>

                {/* Sidebar Settings */}
                <div className="space-y-10">
                    <Card className="bg-surface border-surface-border p-10">
                        <div className="flex items-center space-x-3 mb-10">
                            <Layers className="w-5 h-5 text-primary" />
                            <h3 className="text-[11px] font-black text-foreground uppercase tracking-[0.2em]">Access & Rules</h3>
                        </div>

                        <div className="space-y-8">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-transparent hover:border-surface-border transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-secondary/10 rounded-xl text-primary">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-foreground uppercase tracking-tight">QR Verification</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Mandatory check</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.qr_checkin_required}
                                    onChange={(e) => setFormData({ ...formData, qr_checkin_required: e.target.checked })}
                                    className="w-6 h-6 rounded-lg bg-background border-surface-border text-primary focus:ring-0"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-2xl bg-background border border-transparent hover:border-surface-border transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-accent/10 rounded-xl text-accent">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-foreground uppercase tracking-tight">Manual Approval</p>
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Vetting required</p>
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={formData.approval_required}
                                    onChange={(e) => setFormData({ ...formData, approval_required: e.target.checked })}
                                    className="w-6 h-6 rounded-lg bg-background border-surface-border text-accent focus:ring-0"
                                />
                            </div>

                            <div className="pt-8 mt-4 border-t border-surface-border">
                                <div className="bg-background/50 p-6 rounded-2xl border border-surface-border relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <Lock className="w-12 h-12 text-amber-500" />
                                    </div>
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-3 mb-3">
                                            <h4 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">Visibility Protocol</h4>
                                        </div>
                                        <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase tracking-widest">
                                            Once published, this program is integrated into the universal organization catalog for all authorized participants.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Preview Indicator */}
                    <div className="p-8 bg-gradient-premium rounded-3xl text-white shadow-2xl shadow-indigo-500/20">
                        <div className="flex items-center space-x-3 mb-6">
                            <Sparkles className="w-5 h-5 flex-shrink-0" />
                            <h4 className="text-xs font-black uppercase tracking-widest">Ready to Launch</h4>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 leading-relaxed">
                            System is prepared to secure all digital records for "{formData.name || 'your new program'}".
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
