import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { GlassBox } from '@/components/ui/Card';
import { useNavigate, useParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Sparkles, Loader2, Eye, EyeOff, AlertCircle, HelpCircle } from 'lucide-react';
import { authService } from '@/services/authService';
import { supabase } from '@/services/supabase';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [trials, setTrials] = useState(0);
    const navigate = useNavigate();
    const { switchOrganization } = useOrganization();
    const { user: authUser, profile: authProfile } = useAuth();
    const { orgSlug } = useParams();

    // Auto-redirect if already authenticated
    React.useEffect(() => {
        if (authUser && authProfile) {
            if (orgSlug) {
                const isPart = authProfile.role === 'participant' || authProfile.role === 'facilitator';
                navigate(isPart ? `/portal/${orgSlug}/dashboard` : '/dashboard');
            } else {
                const isPart = authProfile.role === 'participant' || authProfile.role === 'facilitator';
                const lastSlug = localStorage.getItem('active_org_slug');
                if (isPart && lastSlug) {
                    navigate(`/portal/${lastSlug}/dashboard`);
                } else {
                    navigate('/dashboard');
                }
            }
        }
    }, [authUser, authProfile, orgSlug, navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            setError(null);

            if (trials >= 5) {
                setError('Account Guard: Too many failed attempts. Please reset your password to regain access.');
                return;
            }

            const { user } = await authService.signIn(email, password);

            if (user) {
                setTrials(0); // Reset on success
                // Fetch ALL profiles associated with this user
                const { data: profiles } = await supabase
                    .from('users')
                    .select('role, organization_id, organizations(slug)')
                    .eq('auth_id', user.id);

                if (profiles && profiles.length > 0) {
                    // ... (keep navigation logic identical)
                    if (orgSlug) {
                        const targetProfile = profiles.find((p: any) => p.organizations?.slug === orgSlug);

                        if (targetProfile) {
                            if (targetProfile.role === 'participant' || targetProfile.role === 'facilitator') {
                                navigate(`/portal/${orgSlug}/dashboard`);
                            } else {
                                await switchOrganization(orgSlug);
                                navigate('/dashboard');
                            }
                            return;
                        }

                        setError('You are not a participant of this organization.');
                        await authService.signOut();
                        return;
                    }

                    const lastSlug = localStorage.getItem('active_org_slug');
                    if (lastSlug) {
                        const match = profiles.find((p: any) => p.organizations?.slug === lastSlug);
                        if (match) {
                            if (match.role === 'participant' || match.role === 'facilitator') {
                                navigate(`/portal/${lastSlug}/dashboard`);
                            } else {
                                await switchOrganization(lastSlug);
                                navigate('/dashboard');
                            }
                            return;
                        }
                    }

                    const first = profiles[0];
                    const slug = (first.organizations as any)?.slug;
                    if (first.role === 'participant' || first.role === 'facilitator') {
                        navigate(`/portal/${slug}/dashboard`);
                    } else {
                        await switchOrganization(slug);
                        navigate('/dashboard');
                    }
                } else {
                    setError('No account profiles found.');
                    await authService.signOut();
                }
            }
        } catch (err: any) {
            const newTrials = trials + 1;
            setTrials(newTrials);

            if (newTrials >= 5) {
                setError('Multiple failed attempts detected. For your security, please use the "Forgot Password" flow.');
            } else {
                setError(`${err.message} (${5 - newTrials} attempts remaining)`);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-500/10 rounded-full blur-[120px]"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-md relative z-10"
            >
                <div className="text-center mb-10">
                    <div className="w-20 h-20 bg-gradient-premium rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl shadow-2xl shadow-primary/10 animate-pulse-subtle">
                        ⛪
                    </div>
                    <h2 className="text-4xl font-black text-foreground tracking-tight mb-2 uppercase">Sign In</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Access your Digital Ministry</p>
                </div>

                <GlassBox className="p-10 border-surface-border bg-surface backdrop-blur-2xl transition-all">
                    <form className="space-y-8" onSubmit={handleLogin}>
                        {error && (
                            <div className={`p-4 ${trials >= 5 ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500'} border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center shadow-lg transition-all`}>
                                <div className="flex items-center justify-center gap-2">
                                    {trials >= 5 ? <AlertCircle className="w-4 h-4" /> : null}
                                    {error}
                                </div>
                            </div>
                        )}
                        <div className="space-y-6">
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:border-primary/50 focus:ring-0 transition-all outline-none font-medium"
                                    required
                                    disabled={trials >= 5}
                                />
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-12 pr-14 py-4 rounded-2xl border border-surface-border bg-background text-foreground placeholder:text-slate-400 focus:border-indigo-500/50 focus:ring-0 transition-all outline-none font-medium"
                                    required
                                    disabled={trials >= 5}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors h-10 w-10 flex items-center justify-center rounded-xl hover:bg-surface"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-500 hover:text-foreground transition-colors">
                                <input type="checkbox" className="rounded bg-background border-surface-border text-primary focus:ring-0 h-4 w-4" />
                                <span>Remember me</span>
                            </label>
                            <span
                                className={`flex items-center gap-1 ${trials >= 5 ? 'text-indigo-500 font-bold scale-110 shadow-indigo-100' : 'text-primary'} hover:text-primary-dark cursor-pointer transition-all animate-bounce-subtle`}
                                onClick={() => navigate('/forgot-password')}
                            >
                                <HelpCircle className="w-4 h-4" /> Forgot Password?
                            </span>
                        </div>

                        <Button type="submit" className="w-full h-16 text-lg font-black uppercase tracking-widest" variant="premium" disabled={loading || trials >= 5}>
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : trials >= 5 ? 'Account Locked' : <>Sign In Now <ArrowRight className="ml-3 w-6 h-6" /></>}
                        </Button>
                    </form>
                </GlassBox>

            </motion.div>

            {/* Bottom Accent */}
            <div className="absolute bottom-8 left-0 right-0 text-center opacity-20 flex items-center justify-center space-x-2">
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Trust In Digital Excellence</span>
            </div>
        </div>
    );
}
