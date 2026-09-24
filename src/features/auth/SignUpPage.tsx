import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { GlassBox, Card } from '@/components/ui/Card';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Palette, ArrowRight, ArrowLeft, CheckCircle2, Sparkles, Globe, Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { authService } from '@/services/authService';

import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

const THEME_PRESETS = [
    { name: 'Royal', primary: '#6366f1', secondary: '#ec4899', desc: 'Majestic & Bold' },
    { name: 'Grace', primary: '#10b981', secondary: '#3b82f6', desc: 'Serene & Trusting' },
    { name: 'Sacred', primary: '#f59e0b', secondary: '#9f1239', desc: 'Warm & Traditional' },
    { name: 'Modern', primary: '#0f172a', secondary: '#6366f1', desc: 'Sleek & Professional' },
];

export function SignUpPage() {
    const { refreshProfile } = useAuth();
    const { switchOrganization } = useOrganization();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        orgName: '',
        orgSlug: '',
        adminName: '',
        adminEmail: '',
        password: '',
        confirmPassword: '',
        primaryColor: '#6366f1',
        secondaryColor: '#ec4899',
    });

    const [loading, setLoading] = useState(false);
    const [checkingSlug, setCheckingSlug] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const calculatePasswordStrength = (pass: string) => {
        let strength = 0;
        if (pass.length === 0) return { label: 'Awaiting Input', score: 0, color: 'slate' };
        if (pass.length > 5) strength++;
        if (/[A-Z]/.test(pass)) strength++;
        if (/[0-9]/.test(pass)) strength++;
        if (/[^A-Za-z0-9]/.test(pass)) strength++;

        if (strength < 2) return { label: 'Weak Soul', score: 1, color: 'red', advice: 'Try adding numbers or symbols.' };
        if (strength < 3) return { label: 'Average Watcher', score: 2, color: 'orange', advice: 'Almost there! Add a capital letter.' };
        if (strength < 4) return { label: 'Strong Guardian', score: 3, color: 'indigo', advice: 'Great choice! This is a solid guard.' };
        return { label: 'Divine Integrity', score: 4, color: 'emerald', advice: 'Impenetrable. Your account is well-protected.' };
    };

    const passStrength = calculatePasswordStrength(formData.password);

    const handleRegister = async () => {
        if (formData.password !== formData.confirmPassword) {
            setError('The confirmed password does not match. Please verify your entry.');
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const { organization } = await authService.signUp(formData);

            await refreshProfile();

            // Set the new organization as active immediately
            if (organization?.slug) {
                await switchOrganization(organization.slug);
            }

            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateFormData = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: value,
            // Always auto-generate slug when name changes, since user can't see/edit it anymore
            ...(field === 'orgName' ? { orgSlug: value.toLowerCase().replace(/[^a-z0-9]/g, '') } : {})
        }));
    };

    const nextStep = async () => {
        if (step === 1) {
            if (!formData.adminName || !formData.adminEmail || !formData.password) {
                setError('All identity fields are required.');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setError('Password confirmation mismatch. Please verify your password entry.');
                return;
            }
            if (formData.password.length < 6) {
                setError('Your password requires more substance (minimum 6 characters).');
                return;
            }
        }
        if (step === 2) {
            setCheckingSlug(true);
            setError(null);
            try {
                const isAvailable = await authService.checkSlugAvailability(formData.orgSlug);
                if (!isAvailable) {
                    setError('This organization name is already registered. Please choose a different name.');
                    return;
                }
            } catch (err: any) {
                console.error('Availability check failed:', err);
                setError(err.message || 'Verification failed. Please check your connection.');
                return;
            } finally {
                setCheckingSlug(false);
            }
        }
        setStep(s => s + 1);
    };

    const prevStep = () => setStep(s => s - 1);

    const steps = [
        { title: 'Identity', icon: <User className="w-5 h-5" /> },
        { title: 'Organization', icon: <Building2 className="w-5 h-5" /> },
        { title: 'Visuals', icon: <Palette className="w-5 h-5" /> }
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/5 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-pink-500/5 rounded-full blur-[120px]"></div>

            {/* Progress Header */}
            <div className="w-full max-w-xl mb-16 relative z-10">
                <div className="flex justify-between relative px-4">
                    <div className="absolute top-[20px] left-0 w-full h-[1px] bg-surface-border z-0"></div>
                    {steps.map((s, i) => (
                        <div key={i} className="relative z-10 flex flex-col items-center">
                            <motion.div
                                animate={{
                                    scale: step === i + 1 ? 1.1 : 1,
                                    backgroundColor: step > i + 1 ? 'var(--color-primary)' : step === i + 1 ? 'var(--color-surface)' : 'transparent'
                                }}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${step > i + 1 ? 'border-transparent text-white' :
                                    step === i + 1 ? 'border-primary shadow-[0_0_20px_rgba(99,102,241,0.1)] text-primary' :
                                        'border-surface-border text-slate-400'
                                    }`}
                            >
                                {step > i + 1 ? <CheckCircle2 className="w-6 h-6" /> : s.icon}
                            </motion.div>
                            <span className={`text-[9px] mt-3 font-black uppercase tracking-[0.2em] ${step === i + 1 ? 'text-foreground' : 'text-slate-500'}`}>
                                {s.title}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-xl relative z-10"
            >
                <GlassBox className="p-10 border-surface-border bg-surface backdrop-blur-3xl overflow-hidden min-h-[500px] flex flex-col">
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs text-center flex flex-col items-center gap-2">
                            <div className="flex items-center gap-2 font-black uppercase tracking-wider text-[11px]">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{error.includes('Supabase') || error.includes('database') ? 'Database Connection Alert' : 'Registration Alert'}</span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 max-w-md">{error}</p>
                            {(error.includes('Supabase') || error.includes('database')) && (
                                <a
                                    href="https://supabase.com/dashboard"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary hover:underline"
                                >
                                    Open Supabase Dashboard &rarr;
                                </a>
                            )}
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8 flex-1 flex flex-col"
                            >
                                <div className="text-center mb-4">
                                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight">Admin Identity</h2>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Personalize your administrator profile</p>
                                </div>
                                <div className="space-y-6 flex-1">
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Full Legal Name"
                                            value={formData.adminName}
                                            onChange={(e) => updateFormData('adminName', e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:border-primary/50 outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="relative group">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                        <input
                                            type="email"
                                            placeholder="Primary Email Address"
                                            value={formData.adminEmail}
                                            onChange={(e) => updateFormData('adminEmail', e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:border-primary/50 outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Secure Access Password"
                                                value={formData.password}
                                                onChange={(e) => updateFormData('password', e.target.value)}
                                                className="w-full pl-12 pr-14 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:border-primary/50 outline-none transition-all shadow-inner"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors h-10 w-10 flex items-center justify-center rounded-xl hover:bg-surface"
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>

                                        {/* AI Strength Indicator */}
                                        {formData.password && (() => {
                                            const COLOR_MAP: Record<string, { bg: string; text: string; border: string; bar: string }> = {
                                                red: { bg: 'bg-red-50/30', text: 'text-red-600', border: 'border-red-100', bar: 'bg-red-500 shadow-sm' },
                                                orange: { bg: 'bg-orange-50/30', text: 'text-orange-600', border: 'border-orange-100', bar: 'bg-orange-500 shadow-sm' },
                                                indigo: { bg: 'bg-indigo-50/30', text: 'text-indigo-600', border: 'border-indigo-100', bar: 'bg-indigo-500 shadow-sm' },
                                                emerald: { bg: 'bg-emerald-50/30', text: 'text-emerald-600', border: 'border-emerald-100', bar: 'bg-emerald-500 shadow-sm' },
                                                slate: { bg: 'bg-slate-50/30', text: 'text-slate-600', border: 'border-slate-100', bar: 'bg-slate-500 shadow-sm' },
                                            };
                                            const colors = COLOR_MAP[passStrength.color] || COLOR_MAP.slate;
                                            return (
                                                <motion.div
                                                    initial={{ opacity: 0, y: -10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`p-4 rounded-2xl border ${colors.border} ${colors.bg} space-y-3`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <ShieldCheck className={`w-4 h-4 ${colors.text}`} />
                                                            <span className={`text-[10px] font-black uppercase tracking-widest ${colors.text}`}>
                                                                {passStrength.label}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {[1, 2, 3, 4].map(i => (
                                                                <div
                                                                    key={i}
                                                                    className={`h-1.5 w-8 rounded-full transition-all duration-500 ${i <= passStrength.score ? colors.bar : 'bg-slate-200'}`}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                                                        <Sparkles className="w-3 h-3 inline mr-1 text-indigo-400" /> {passStrength.advice}
                                                    </p>
                                                </motion.div>
                                            );
                                        })()}

                                        <div className="relative group">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Confirm Secure Password"
                                                value={formData.confirmPassword}
                                                onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                                                className={`w-full pl-12 pr-4 py-4 rounded-2xl border ${formData.confirmPassword && formData.password !== formData.confirmPassword ? 'border-red-200 ring-2 ring-red-50' : 'border-surface-border'} bg-background text-foreground placeholder:text-slate-400 focus:border-primary/50 outline-none transition-all shadow-inner`}
                                            />
                                            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                                                <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Integrity Check Failed: Passwords do not match
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={nextStep} className="w-full h-16 text-lg font-black uppercase tracking-widest mt-4" variant="premium">
                                    Step 02: Organization <ArrowRight className="ml-3 w-6 h-6" />
                                </Button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8 flex-1 flex flex-col"
                            >
                                <div className="text-center mb-4">
                                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight">Organization Core</h2>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Define your organization's digital home</p>
                                </div>
                                <div className="space-y-6 flex-1">
                                    <div className="relative group">
                                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Organization Name"
                                            value={formData.orgName}
                                            onChange={(e) => updateFormData('orgName', e.target.value)}
                                            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:border-primary/50 outline-none transition-all shadow-inner"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-bold px-4">
                                        We'll automatically set up your digital environment based on your organization name.
                                    </p>
                                </div>
                                <div className="flex gap-4">
                                    <Button variant="outline" onClick={prevStep} className="flex-1 h-16 border-surface-border text-slate-500 font-black uppercase tracking-widest">
                                        Back
                                    </Button>
                                    <Button onClick={nextStep} className="flex-[2] h-16 text-lg font-black uppercase tracking-widest" variant="premium" disabled={checkingSlug}>
                                        {checkingSlug ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Step 03: Visual Identity <ArrowRight className="ml-3 w-6 h-6" /></>}
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8 flex-1 flex flex-col"
                            >
                                <div className="text-center mb-4">
                                    <h2 className="text-3xl font-black text-foreground uppercase tracking-tight">Visual Identity</h2>
                                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Custom brand aesthetics for your ministry</p>
                                </div>

                                <div className="space-y-4 mb-4">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Suggested Customization</label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {THEME_PRESETS.map((t) => (
                                            <button
                                                key={t.name}
                                                type="button"
                                                onClick={() => {
                                                    updateFormData('primaryColor', t.primary);
                                                    updateFormData('secondaryColor', t.secondary);
                                                }}
                                                className={`p-4 rounded-2xl border transition-all text-left group flex flex-col items-center justify-center space-y-2 ${formData.primaryColor === t.primary && formData.secondaryColor === t.secondary
                                                    ? 'border-primary bg-primary/5 shadow-lg'
                                                    : 'border-surface-border bg-background hover:border-primary/20 hover:shadow-md'
                                                    }`}
                                            >
                                                <div className="flex -space-x-2">
                                                    <div className="w-6 h-6 rounded-full border-2 border-surface shadow-sm" style={{ backgroundColor: t.primary }}></div>
                                                    <div className="w-6 h-6 rounded-full border-2 border-surface shadow-sm" style={{ backgroundColor: t.secondary }}></div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-foreground">{t.name}</p>
                                                    <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">{t.desc}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6 mb-4">
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Primary Tone</label>
                                        <div className="flex items-center gap-4 bg-background p-3 rounded-2xl border border-surface-border hover:border-primary/20 transition-colors shadow-inner">
                                            <input
                                                type="color"
                                                value={formData.primaryColor}
                                                onChange={(e) => updateFormData('primaryColor', e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer border-none p-0 bg-transparent"
                                            />
                                            <span className="text-xs font-mono text-slate-500">{formData.primaryColor}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Accent Tone</label>
                                        <div className="flex items-center gap-4 bg-background p-3 rounded-2xl border border-surface-border hover:border-primary/20 transition-colors shadow-inner">
                                            <input
                                                type="color"
                                                value={formData.secondaryColor}
                                                onChange={(e) => updateFormData('secondaryColor', e.target.value)}
                                                className="w-10 h-10 rounded-lg cursor-pointer border-none p-0 bg-transparent"
                                            />
                                            <span className="text-xs font-mono text-slate-500">{formData.secondaryColor}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview Card */}
                                <div className="flex-1 bg-background rounded-3xl p-8 border border-surface-border relative overflow-hidden shadow-xl">
                                    <div
                                        className="absolute inset-0 opacity-10 blur-2xl"
                                        style={{ background: `radial-gradient(circle at top left, ${formData.primaryColor}, ${formData.secondaryColor})` }}
                                    ></div>
                                    <div className="relative z-10 flex flex-col h-full border-l-2 pl-6" style={{ borderColor: formData.primaryColor }}>
                                        <h4 className="text-2xl font-black text-foreground uppercase tracking-tighter mb-1">{formData.orgName || 'Elegance Ministry'}</h4>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">Enterprise Dashboard</p>
                                        <div className="mt-auto flex items-center space-x-3">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-primary" />
                                            </div>
                                            <div className="flex-1 h-1 bg-surface-border rounded-full overflow-hidden">
                                                <div className="h-full w-2/3" style={{ background: formData.primaryColor }}></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button variant="outline" onClick={prevStep} className="flex-1 h-16 border-surface-border text-slate-500 font-black uppercase tracking-widest">
                                        Back
                                    </Button>
                                    <Button variant="premium" className="flex-[2] h-16 text-lg font-black uppercase tracking-widest" onClick={handleRegister} disabled={loading}>
                                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Authorize Setup'}
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </GlassBox>
            </motion.div>

            <p className="mt-12 text-[11px] text-slate-600 font-black uppercase tracking-[0.3em] relative z-10">
                Found your home? <span className="text-primary hover:text-primary/80 cursor-pointer transition-colors" onClick={() => navigate('/login')}>Sign In Now</span>
            </p>
        </div>
    );
}
