import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { assignmentService } from '@/services/assignmentService';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
    Plus,
    FileText,
    Calendar,
    CheckCircle,
    Clock,
    User,
    ChevronRight,
    Loader2,
    XCircle,
    Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function AssignmentManager({ programId }: { programId: string }) {
    const { user, profile } = useAuth();
    const { organization } = useOrganization();
    const orgId = organization?.id || profile?.organization_id;
    const [assignments, setAssignments] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
    const [submissions, setSubmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
    const [viewMode, setViewMode] = useState<'individual' | 'global'>('individual');
    const [allSubmissions, setAllSubmissions] = useState<any[]>([]);

    // New Assignment Form State
    const [newAssignment, setNewAssignment] = useState({
        name: '',
        description: '',
        due_date: '',
        session_id: '',
        max_score: 100
    });
    const [createError, setCreateError] = useState<string | null>(null);

    useEffect(() => {
        if (organization) {
            fetchAssignments();
            fetchSessions();
            fetchAllSubmissions();
        }
    }, [organization, programId]);

    const fetchAllSubmissions = async () => {
        try {
            // This is a bit heavy but ensures admin sees "everything"
            const { data } = await supabase
                .from('assignment_submissions')
                .select(`
                    *,
                    users (first_name, surname),
                    assignments (name, session_id)
                `)
                .eq('organization_id', organization!.id);

            // Filter by program sessions
            const { data: sessionData } = await supabase
                .from('sessions')
                .select('id')
                .eq('program_id', programId);
            const sessionIds = sessionData?.map(s => s.id) || [];

            const filtered = data?.filter(sub => sessionIds.includes(sub.assignments.session_id)) || [];
            setAllSubmissions(filtered);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSessions = async () => {
        try {
            const { data } = await supabase
                .from('sessions')
                .select('*')
                .eq('program_id', programId)
                .order('sort_order', { ascending: true });
            setSessions(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchAssignments = async () => {
        setLoading(true);
        try {
            // Get all sessions for this program first to filter assignments
            const { data: sessionData } = await supabase
                .from('sessions')
                .select('id')
                .eq('program_id', programId);

            const sessionIds = sessionData?.map(s => s.id) || [];

            if (sessionIds.length === 0) {
                setAssignments([]);
                return;
            }

            if (!orgId) {
                setAssignments([]);
                return;
            }

            const data = await assignmentService.getAssignments(orgId);
            // Filter by program's sessions
            const filtered = data?.filter(asg => sessionIds.includes(asg.session_id)) || [];
            setAssignments(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubmissions = async (assignmentId: string) => {
        try {
            const data = await assignmentService.getSubmissions(assignmentId);
            setSubmissions(data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateAssignment = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateError(null);
        if (!orgId) {
            setCreateError('Organization context missing. Please refresh and try again.');
            return;
        }
        if (!newAssignment.session_id) {
            setCreateError('Please select a session for this assignment.');
            return;
        }
        try {
            await assignmentService.createAssignment({
                ...newAssignment,
                organization_id: orgId,
                is_active: true
            });
            setIsCreateModalOpen(false);
            setNewAssignment({ name: '', description: '', due_date: '', session_id: '', max_score: 100 });
            fetchAssignments();
        } catch (err: any) {
            console.error(err);
            setCreateError(err?.message || 'Failed to create assignment. Please try again.');
        }
    };

    const handleGradeSubmission = async (gradeData: any) => {
        try {
            await assignmentService.gradeSubmission(selectedSubmission.id, gradeData);
            setIsGradingModalOpen(false);
            if (selectedAssignment) fetchSubmissions(selectedAssignment.id);
            fetchAllSubmissions();
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return (
        <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center bg-surface p-6 rounded-3xl border border-surface-border">
                <div>
                    <h4 className="text-sm font-black text-foreground uppercase tracking-tight">Assignment Matrix</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Deploy tasks and evaluate participant performance</p>
                </div>
                <div className="flex gap-4">
                    <div className="flex bg-background p-1 rounded-xl border border-surface-border mr-4">
                        <button
                            onClick={() => setViewMode('individual')}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'individual' ? 'bg-primary text-white' : 'text-slate-500 hover:text-foreground'}`}
                        >
                            By Task
                        </button>
                        <button
                            onClick={() => setViewMode('global')}
                            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'global' ? 'bg-primary text-white' : 'text-slate-500 hover:text-foreground'}`}
                        >
                            Everything
                        </button>
                    </div>
                    <Button
                        variant="premium"
                        size="sm"
                        className="h-10 text-[10px] font-black uppercase tracking-widest"
                        onClick={() => setIsCreateModalOpen(true)}
                    >
                        <Plus className="w-3 h-3 mr-2" /> New Assignment
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {viewMode === 'individual' ? (
                    <>
                        {/* Assignment List */}
                        <div className="space-y-4">
                            {assignments.map((assignment) => (
                                <Card
                                    key={assignment.id}
                                    className={`p-6 bg-surface border-surface-border hover:border-primary/30 transition-all cursor-pointer group ${selectedAssignment?.id === assignment.id ? 'border-primary/50 bg-primary/5' : ''}`}
                                    onClick={() => {
                                        setSelectedAssignment(assignment);
                                        fetchSubmissions(assignment.id);
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-background flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors border border-surface-border">
                                                <FileText className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-black text-foreground uppercase tracking-tight">{assignment.name}</h5>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center">
                                                        <Calendar className="w-3 h-3 mr-1 text-pink-500" /> {new Date(assignment.due_date).toLocaleDateString()}
                                                    </span>
                                                    {assignment.sessions?.name && (
                                                        <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                                                            {assignment.sessions.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 text-slate-300 transition-transform ${selectedAssignment?.id === assignment.id ? 'rotate-90 text-primary' : ''}`} />
                                    </div>
                                </Card>
                            ))}
                        </div>

                        {/* Submissions View */}
                        <div className="space-y-4">
                            <AnimatePresence mode="wait">
                                {selectedAssignment ? (
                                    <motion.div
                                        key={selectedAssignment.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="space-y-4"
                                    >
                                        <div className="flex items-center justify-between px-2">
                                            <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Submissions ({submissions.length})</h5>
                                        </div>
                                        {submissions.length > 0 ? submissions.map((sub) => (
                                            <Card key={sub.id} className="p-4 bg-surface border-surface-border flex items-center justify-between group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center text-[10px] font-black text-primary border border-surface-border">
                                                        {sub.users.first_name[0]}{sub.users.surname[0]}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-foreground uppercase">{sub.users.first_name} {sub.users.surname}</p>
                                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                            {new Date(sub.submitted_at).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {sub.status === 'graded' ? (
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">{sub.score}/{selectedAssignment.max_score}</span>
                                                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="h-8 text-[9px] font-black uppercase tracking-widest border-surface-border bg-background hover:bg-surface"
                                                            onClick={() => {
                                                                setSelectedSubmission(sub);
                                                                setIsGradingModalOpen(true);
                                                            }}
                                                        >
                                                            Grade Task
                                                        </Button>
                                                    )}
                                                </div>
                                            </Card>
                                        )) : (
                                            <div className="text-center py-20 bg-background rounded-3xl border border-dashed border-surface-border">
                                                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Awaiting intake...</p>
                                            </div>
                                        )}
                                    </motion.div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-background rounded-3xl border border-dashed border-surface-border">
                                        <FileText className="w-12 h-12 text-slate-300 mb-4" />
                                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-tight">Select an assignment</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Review submissions and provide critical feedback</p>
                                    </div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                ) : (
                    <div className="col-span-full space-y-4">
                        <div className="grid gap-4">
                            {allSubmissions.length > 0 ? allSubmissions.map((sub) => (
                                <Card key={sub.id} className="p-6 bg-surface border-surface-border flex flex-col md:flex-row md:items-center justify-between gap-6 group">
                                    <div className="flex items-center gap-6">
                                        <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center text-primary border border-surface-border group-hover:border-primary/30 transition-all">
                                            <User className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-black text-foreground uppercase tracking-tight">{sub.users.first_name} {sub.users.surname}</p>
                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                <p className="text-[9px] font-black text-primary uppercase tracking-widest">{sub.assignments.name}</p>
                                            </div>
                                            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                                                Submitted {new Date(sub.submitted_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {sub.status === 'graded' ? (
                                            <div className="flex items-center gap-3 bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10">
                                                <CheckCircle className="w-4 h-4 text-emerald-500" />
                                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Graded: {sub.score} Pts</span>
                                            </div>
                                        ) : (
                                            <Button
                                                variant="premium"
                                                size="sm"
                                                className="h-10 text-[10px] font-black uppercase tracking-widest px-6"
                                                onClick={() => {
                                                    setSelectedSubmission(sub);
                                                    setSelectedAssignment(sub.assignments);
                                                    setIsGradingModalOpen(true);
                                                }}
                                            >
                                                Evaluate Now
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            )) : (
                                <div className="text-center py-20 bg-surface rounded-3xl border border-dashed border-surface-border">
                                    <FileText className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">No program-wide submissions found.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Assignment Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-surface border border-surface-border rounded-3xl w-full max-w-md p-8 shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Deploy Assignment</h3>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-500 hover:text-foreground transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateAssignment} className="space-y-6">
                            {createError && (
                                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold uppercase tracking-widest">
                                    {createError}
                                </div>
                            )}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Session</label>
                                <select
                                    className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none"
                                    value={newAssignment.session_id}
                                    onChange={e => setNewAssignment({ ...newAssignment, session_id: e.target.value })}
                                    required
                                >
                                    <option value="">Select a session...</option>
                                    {sessions.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Assignment Name</label>
                                <input
                                    className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none"
                                    placeholder="e.g. Apostolic Vision Essay"
                                    value={newAssignment.name}
                                    onChange={e => setNewAssignment({ ...newAssignment, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Task Description</label>
                                <textarea
                                    className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none h-24"
                                    placeholder="Outline the core deliverables..."
                                    value={newAssignment.description}
                                    onChange={e => setNewAssignment({ ...newAssignment, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Due Date</label>
                                    <input
                                        type="date"
                                        className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none"
                                        value={newAssignment.due_date}
                                        onChange={e => setNewAssignment({ ...newAssignment, due_date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Points Matrix</label>
                                    <input
                                        type="number"
                                        className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none"
                                        value={newAssignment.max_score}
                                        onChange={e => setNewAssignment({ ...newAssignment, max_score: parseInt(e.target.value) })}
                                        required
                                    />
                                </div>
                            </div>
                            <Button type="submit" variant="premium" className="w-full h-14 uppercase font-black tracking-widest">
                                <Send className="w-4 h-4 mr-2" /> Launch Task
                            </Button>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* Grading Modal */}
            {isGradingModalOpen && selectedSubmission && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4">
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-surface border border-surface-border rounded-3xl w-full max-w-md p-8 shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Evaluate Task</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                    {selectedSubmission.users.first_name} {selectedSubmission.users.surname}
                                </p>
                            </div>
                            <button onClick={() => setIsGradingModalOpen(false)} className="text-slate-500 hover:text-foreground transition-colors">
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="bg-background p-4 rounded-2xl mb-6 border border-surface-border">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Participant Submission</p>
                            <p className="text-sm text-foreground italic">"{selectedSubmission.submission_text || 'No text content provided.'}"</p>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            handleGradeSubmission({
                                score: parseInt(formData.get('score') as string),
                                feedback: formData.get('feedback') as string,
                                graded_by: user!.id
                            });
                        }} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Award Points (Max {selectedAssignment.max_score})</label>
                                <input
                                    name="score"
                                    type="number"
                                    className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none"
                                    max={selectedAssignment.max_score}
                                    min={0}
                                    defaultValue={selectedAssignment.max_score}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Critical Feedback</label>
                                <textarea
                                    name="feedback"
                                    className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none h-24"
                                    placeholder="Provide constructive insight..."
                                />
                            </div>
                            <Button type="submit" variant="premium" className="w-full h-14 uppercase font-black tracking-widest">
                                <CheckCircle className="w-4 h-4 mr-2" /> Complete Evaluation
                            </Button>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
