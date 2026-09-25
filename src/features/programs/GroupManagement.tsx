import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Users, Plus, UserPlus, X, Trash2, Edit2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, GlassBox } from '@/components/ui/Card';

interface Group {
    id: string;
    name: string;
    description: string;
    max_capacity: number;
    facilitator: {
        first_name: string;
        surname: string;
    } | null;
    member_count: number;
}

export function GroupManagement({ programId }: { programId: string }) {
    const { organization } = useOrganization();
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [manageGroup, setManageGroup] = useState<Group | null>(null);

    useEffect(() => {
        if (organization) fetchGroups();
    }, [organization, programId]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('program_groups')
                .select(`
                    *,
                    facilitator:users!facilitator_id (first_name, surname),
                    members:group_members (count)
                `)
                .eq('program_id', programId);

            if (error) throw error;

            const formattedGroups = data.map((g: any) => ({
                ...g,
                member_count: g.members[0]?.count || 0
            }));

            setGroups(formattedGroups);
        } catch (err) {
            console.error('Error fetching groups:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Program Groups</h3>
                    <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Organize participants into cohorts or teams</p>
                </div>
                <Button variant="premium" size="sm" className="h-10 text-[10px] uppercase font-black tracking-widest" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Assemble Group
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {groups.map(group => (
                        <GlassBox key={group.id} className="p-6 border-surface-border bg-surface hover:border-primary/30 transition-all flex flex-col shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2 text-slate-400 hover:text-foreground transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <h4 className="text-lg font-black text-foreground uppercase tracking-tight mb-2">{group.name}</h4>
                            <p className="text-slate-500 text-xs mb-6 flex-1">{group.description || 'No description provided for this group.'}</p>

                            <div className="space-y-4 pt-4 border-t border-surface-border">
                                <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                    <span className="text-slate-500">Lead Facilitator</span>
                                    <span className="text-foreground">{group.facilitator ? `${group.facilitator.first_name} ${group.facilitator.surname}` : 'Unassigned'}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                        <span className="text-slate-500">Fill Rate</span>
                                        <span className="text-primary">{group.member_count} / {group.max_capacity || '∞'}</span>
                                    </div>
                                    <div className="h-1 bg-surface rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: `${group.max_capacity ? (group.member_count / group.max_capacity) * 100 : 0}%` }}
                                        ></div>
                                    </div>
                                </div>

                                <Button 
                                    variant="outline" 
                                    className="w-full h-10 text-[10px] font-black uppercase tracking-widest bg-background border-surface-border hover:border-primary/50 transition-all"
                                    onClick={() => setManageGroup(group)}
                                >
                                    <UserPlus className="w-3 h-3 mr-2" /> Manage Participants
                                </Button>
                            </div>
                        </GlassBox>
                    ))}

                    {groups.length === 0 && (
                        <div className="md:col-span-2 text-center py-20 bg-background rounded-3xl border border-dashed border-surface-border">
                            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">No groups assembled yet</p>
                        </div>
                    )}
                </div>
            )}

            {isCreateModalOpen && (
                <CreateGroupModal
                    programId={programId}
                    onClose={() => setIsCreateModalOpen(false)}
                    onSuccess={() => {
                        setIsCreateModalOpen(false);
                        fetchGroups();
                    }}
                />
            )}

            {manageGroup && (
                <ManageParticipantsModal
                    group={manageGroup}
                    programId={programId}
                    organizationId={organization!.id}
                    onClose={() => setManageGroup(null)}
                    onSuccess={() => {
                        setManageGroup(null);
                        fetchGroups();
                    }}
                />
            )}
        </div>
    );
}

// ─── Create Group Modal ────────────────────────────────────────────────────────
function CreateGroupModal({ programId, onClose, onSuccess }: { programId: string, onClose: () => void, onSuccess: () => void }) {
    const { organization } = useOrganization();
    const { profile } = useAuth();
    const orgId = organization?.id || profile?.organization_id;
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [capacity, setCapacity] = useState(20);
    const [facilitators, setFacilitators] = useState<any[]>([]);
    const [selectedFacilitator, setSelectedFacilitator] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchFacilitators();
    }, [orgId]);

    const fetchFacilitators = async () => {
        if (!orgId) return;
        const { data } = await supabase
            .from('users')
            .select('id, first_name, surname')
            .eq('organization_id', orgId)
            .in('role', ['facilitator', 'program_admin', 'system_admin']); 
        setFacilitators(data || []);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orgId) {
            alert('Organization context is missing. Please refresh and try again.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.from('program_groups').insert([{
                organization_id: orgId,
                program_id: programId,
                name,
                description,
                max_capacity: capacity,
                facilitator_id: selectedFacilitator || null
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <GlassBox className="w-full max-w-md p-8 bg-surface border-surface-border shadow-2xl relative">
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-foreground"><X className="w-6 h-6" /></button>
                <div className="mb-8">
                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">Form Group</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Initialize a new cohort structure</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Group Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Wednesday Bible Study"
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-4 text-foreground text-sm outline-none focus:border-primary/30 transition-all font-bold shadow-inner"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 focus:text-primary transition-colors">Target Capacity</label>
                        <input
                            type="number"
                            required
                            value={capacity}
                            onChange={e => setCapacity(Number(e.target.value))}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-4 text-foreground text-sm outline-none focus:border-primary/30 transition-all font-mono shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Lead Facilitator</label>
                        <select
                            value={selectedFacilitator}
                            onChange={e => setSelectedFacilitator(e.target.value)}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-4 text-foreground text-sm outline-none focus:border-primary/30 transition-all font-bold shadow-inner"
                        >
                            <option value="">Assign Later...</option>
                            {facilitators.map(f => (
                                <option key={f.id} value={f.id}>{f.first_name} {f.surname}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3">Brief Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-4 h-32 text-foreground text-sm outline-none focus:border-primary/30 transition-all font-bold resize-none shadow-inner"
                        ></textarea>
                    </div>

                    <Button type="submit" variant="premium" className="w-full h-14 font-black uppercase tracking-widest" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Assembly'}
                    </Button>
                </form>
            </GlassBox>
        </div>
    );
}

// ─── Manage Participants Modal ────────────────────────────────────────────────
function ManageParticipantsModal({ 
    group, programId, organizationId, onClose, onSuccess 
}: { 
    group: Group;
    programId: string;
    organizationId: string;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);
    const [available, setAvailable] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, [group.id, programId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: memberData } = await supabase
                .from('group_members')
                .select('user:users(id, first_name, surname, email)')
                .eq('group_id', group.id);
            
            setMembers(memberData?.map((m: any) => m.user) || []);

            const { data: enrollData } = await supabase
                .from('enrollments')
                .select('user:users(id, first_name, surname, email)')
                .eq('program_id', programId)
                .in('status', ['active', 'enrolled', 'pending']);
            
            const allParticipants = enrollData?.map((e: any) => e.user) || [];
            const memberIds = new Set(memberData?.map((m: any) => m.user.id));
            setAvailable(allParticipants.filter(p => !memberIds.has(p.id)));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addMember = async (userId: string) => {
        const { error } = await supabase.from('group_members').insert([{
            organization_id: organizationId,
            group_id: group.id,
            user_id: userId,
        }]);
        if (error) alert(error.message);
        else fetchData();
    };

    const removeMember = async (userId: string) => {
        const { error } = await supabase.from('group_members')
            .delete()
            .eq('group_id', group.id)
            .eq('user_id', userId);
        if (error) alert(error.message);
        else fetchData();
    };

    const filteredAvailable = available.filter(p => 
        `${p.first_name} ${p.surname}`.toLowerCase().includes(search.toLowerCase()) ||
        p.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <GlassBox className="w-full max-w-2xl p-0 bg-surface border-surface-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="p-8 border-b border-surface-border flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">Group Roster</h3>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">{group.name} • {members.length} Members</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-foreground transition-colors"><X className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8">
                    <div className="relative group">
                        <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text"
                            placeholder="Add participants by name or email..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full h-14 bg-background border border-surface-border rounded-2xl pl-12 pr-6 text-sm font-bold text-foreground outline-none focus:border-primary/40 transition-all shadow-inner"
                        />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                Current Members <div className="px-2 py-0.5 bg-primary/10 text-primary rounded-full">{members.length}</div>
                            </h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                {members.map(m => (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-background border border-surface-border rounded-xl group/item">
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-foreground uppercase truncate">{m.first_name} {m.surname}</p>
                                            <p className="text-[10px] text-slate-500 truncate">{m.email}</p>
                                        </div>
                                        <button 
                                            onClick={() => removeMember(m.id)}
                                            className="p-2 text-slate-400 hover:text-rose-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                                {members.length === 0 && (
                                    <div className="text-center py-10 opacity-30 italic text-xs font-bold uppercase tracking-widest border border-dashed border-surface-border rounded-xl">
                                        Empty Group
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Available Enrollees</h4>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                {filteredAvailable.map(p => (
                                    <div key={p.id} className="flex items-center justify-between p-3 hover:bg-background border border-transparent hover:border-surface-border rounded-xl transition-all cursor-pointer group/avail" onClick={() => addMember(p.id)}>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-slate-500 group-hover/avail:text-foreground transition-colors uppercase truncate">{p.first_name} {p.surname}</p>
                                            <p className="text-[10px] opacity-40 truncate">{p.email}</p>
                                        </div>
                                        <Plus className="w-4 h-4 text-primary opacity-0 group-hover/avail:opacity-100 transition-opacity" />
                                    </div>
                                ))}
                                {filteredAvailable.length === 0 && (
                                    <p className="text-center py-10 text-[10px] text-slate-400 font-bold uppercase tracking-widest">No matching enrollees</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-8 border-t border-surface-border bg-background/50">
                    <Button variant="premium" className="w-full h-12 font-black uppercase tracking-widest text-[10px]" onClick={onSuccess}>
                        Save Roster & Close
                    </Button>
                </div>
            </GlassBox>
        </div>
    );
}
