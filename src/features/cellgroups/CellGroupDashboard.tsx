import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/services/supabase';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { GlassBox } from '@/components/ui/Card';
import {
    Loader2, Users, CalendarPlus, ClipboardList,
    Calendar, X, MapPin, Clock, Plus, UsersRound, CheckCircle2, UserPlus, Trash2, Search, Settings, AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CellGroup {
    id: string;
    name: string;
    description: string;
    max_capacity: number;
    member_count: number;
    last_meeting_date: string | null;
    open_meeting_id: string | null;
    program_id: string;
    facilitator_id?: string | null;
    second_facilitator_id?: string | null;
    facilitator?: { first_name: string; surname: string } | null;
    second_facilitator?: { first_name: string; surname: string } | null;
}

export function CellGroupDashboard() {
    const { organization } = useOrganization();
    const { profile, user } = useAuth();
    const { orgSlug } = useParams();
    const navigate = useNavigate();
    const basePath = orgSlug ? `/portal/${orgSlug}/dashboard/cell-groups` : '/dashboard/cell-groups';

    const [groups, setGroups] = useState<CellGroup[]>([]);
    const [stats, setStats] = useState({ groups: 0, participants: 0, facilitators: 0 });
    const [loading, setLoading] = useState(true);
    const [scheduleGroup, setScheduleGroup] = useState<CellGroup | null>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<CellGroup | null>(null);
    const [manageGroup, setManageGroup] = useState<CellGroup | null>(null);
    const [deletingGroup, setDeletingGroup] = useState<CellGroup | null>(null);
    const [programs, setPrograms] = useState<any[]>([]);
    const [facilitators, setFacilitators] = useState<any[]>([]);

    useEffect(() => {
        if (organization && profile) {
            fetchMyGroups();
            if (['system_admin', 'program_admin', 'platform_admin'].includes(profile.role)) {
                fetchMetadata();
            }
        }
    }, [organization, profile]);

    const fetchMetadata = async () => {
        const [programsRes, facilitatorsRes] = await Promise.all([
            supabase.from('programs').select('id, name').eq('organization_id', organization!.id),
            supabase.from('users').select('id, first_name, surname, role').eq('organization_id', organization!.id).in('role', ['facilitator', 'program_admin', 'system_admin'])
        ]);
        setPrograms(programsRes.data || []);
        setFacilitators(facilitatorsRes.data || []);
    };

    const fetchMyGroups = async () => {
        setLoading(true);
        try {
            // Admins see all groups, facilitators only see theirs
            let query = supabase
                .from('program_groups')
                .select(`
                    id,
                    name,
                    description,
                    max_capacity,
                    program_id,
                    facilitator_id,
                    second_facilitator_id,
                    facilitator:facilitator_id(id, first_name, surname),
                    second_facilitator:second_facilitator_id(id, first_name, surname),
                    members:group_members(count)
                `)
                .eq('organization_id', organization!.id);

            if (profile!.role !== 'system_admin' && profile!.role !== 'program_admin' && profile!.role !== 'platform_admin') {
                query = query.or(`facilitator_id.eq.${profile!.id},second_facilitator_id.eq.${profile!.id}`);
            }

            const { data, error } = await query;

            if (error) throw error;

            const groupsWithMeetings = await Promise.all(
                (data || []).map(async (g: any) => {
                    const { data: meetings } = await supabase
                        .from('cell_meetings')
                        .select('id, scheduled_date, status')
                        .eq('group_id', g.id)
                        .order('scheduled_date', { ascending: false })
                        .limit(5);

                    const openMeeting = meetings?.find((m: any) => m.status === 'open');
                    const lastClosed = meetings?.find((m: any) => m.status === 'closed');

                    return {
                        ...g,
                        member_count: g.members[0]?.count || 0,
                        last_meeting_date: lastClosed?.scheduled_date || null,
                        open_meeting_id: openMeeting?.id || null,
                    };
                })
            );

            setGroups(groupsWithMeetings);

            // Compute summary stats
            const totalParticipants = groupsWithMeetings.reduce((sum, g) => sum + (g.member_count || 0), 0);
            const { data: facData } = await supabase
                .from('users')
                .select('id', { count: 'exact', head: true })
                .eq('organization_id', organization!.id)
                .in('role', ['facilitator', 'program_admin']);
            setStats({
                groups: groupsWithMeetings.length,
                participants: totalParticipants,
                facilitators: (facData as any)?.length ?? 0
            });
        } catch (err) {
            console.error('Error fetching cell groups:', err);
        } finally {
            setLoading(false);
        }
    };

    async function deleteGroup(id: string) {
        try {
            await supabase.from('group_members').delete().eq('group_id', id);
            await supabase.from('cell_meetings').delete().eq('group_id', id);
            const { error } = await supabase.from('program_groups').delete().eq('id', id);
            if (error) throw error;
        } catch (err: any) {
            alert('Error deleting group: ' + err.message);
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-12 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight uppercase">Cell Groups</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">
                        Your small groups — schedule independent meetings &amp; track attendance
                    </p>
                </div>

                {['system_admin', 'program_admin', 'platform_admin'].includes(profile?.role) && (
                    <Button
                        variant="united"
                        className="h-14 px-8"
                        onClick={() => {
                            setEditingGroup(null);
                            setIsGroupModalOpen(true);
                        }}
                    >
                        <Plus className="w-5 h-5 mr-3" /> Create New Group
                    </Button>
                )}
            </div>

            {/* Stats Bar */}
            {!loading && (
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Cell Groups', value: stats.groups, icon: UsersRound },
                        { label: 'Total Members', value: stats.participants, icon: Users },
                        { label: 'Facilitators', value: stats.facilitators, icon: CheckCircle2 },
                    ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="bg-surface border border-surface-border rounded-2xl px-6 py-5 flex items-center gap-4 shadow-sm">
                            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
                                <Icon className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <p className="text-2xl font-black text-foreground leading-none">{value}</p>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">{label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {loading ? (
                <div className="flex justify-center py-24">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
            ) : groups.length === 0 ? (
                <div className="text-center py-32 border border-dashed border-surface-border rounded-3xl bg-surface/30">
                    <Users className="w-14 h-14 text-slate-600 mx-auto mb-4" />
                    <p className="text-foreground font-black uppercase tracking-widest text-sm mb-2">No Groups Assigned</p>
                    <p className="text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                        Ask your program admin to assign you to a cell group.
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {groups.map((group, i) => (
                        <motion.div
                            key={group.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <GlassBox className="p-8 border-surface-border bg-surface hover:border-primary/30 transition-all flex flex-col gap-6 shadow-xl">

                                <div className="flex items-start justify-between">
                                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                        <Users className="w-6 h-6 text-primary" />
                                    </div>
                                    {['system_admin', 'program_admin', 'platform_admin'].includes(profile?.role) && (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditingGroup(group);
                                                    setIsGroupModalOpen(true);
                                                }}
                                                className="p-2.5 bg-surface-hover/50 rounded-xl border border-surface-border hover:border-primary/40 hover:text-primary transition-all shadow-sm"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setDeletingGroup(group)}
                                                className="p-2.5 bg-rose-500/5 rounded-xl border border-surface-border hover:border-rose-500/40 hover:text-rose-400 transition-all shadow-sm"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1">
                                    <h3 className="text-xl font-black text-foreground uppercase tracking-tight">{group.name}</h3>
                                    {(group.facilitator || group.second_facilitator) && (
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="flex -space-x-2">
                                                {group.facilitator && (
                                                    <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-black text-[7px] text-primary">
                                                        {group.facilitator.first_name[0]}{group.facilitator.surname[0]}
                                                    </div>
                                                )}
                                                {group.second_facilitator && (
                                                    <div className="w-5 h-5 rounded-full bg-slate-500/20 border border-slate-500/30 flex items-center justify-center font-black text-[7px] text-slate-400">
                                                        {group.second_facilitator.first_name[0]}{group.second_facilitator.surname[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                                {group.facilitator ? `${group.facilitator.first_name} ${group.facilitator.surname}` : ''}
                                                {group.facilitator && group.second_facilitator && ' + '}
                                                {group.second_facilitator ? `${group.second_facilitator.first_name} ${group.second_facilitator.surname}` : ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <p className="text-slate-500 text-xs leading-relaxed text-slate-400 font-medium">
                                    {group.description || 'No description provided.'}
                                </p>

                                <div className="flex gap-6 py-4 border-y border-surface-border">
                                    <div>
                                        <p className="text-2xl font-black text-foreground">{group.member_count}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Members</p>
                                    </div>
                                    <div>
                                        <p className="text-2xl font-black text-foreground">{group.max_capacity || '∞'}</p>
                                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Capacity</p>
                                    </div>
                                    {group.last_meeting_date && (
                                        <div className="ml-auto text-right">
                                            <div className="flex items-center gap-1 text-slate-400 justify-end">
                                                <Calendar className="w-3 h-3" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">Last Meeting</p>
                                            </div>
                                            <p className="text-xs font-black text-foreground mt-0.5">
                                                {new Date(group.last_meeting_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-col gap-3">
                                        <Button
                                            variant="ghost"
                                            className="w-full text-primary h-10 text-[9px] font-black uppercase tracking-widest hover:bg-primary/5"
                                            onClick={() => setManageGroup(group)}
                                        >
                                            <UsersRound className="w-4 h-4 mr-2" /> Manage Members
                                        </Button>


                                </div>
                            </GlassBox>
                        </motion.div>
                    ))}
                </div>
            )}

            {scheduleGroup && (
                <ScheduleMeetingModal
                    group={scheduleGroup}
                    organizationId={organization?.id || profile?.organization_id || ''}
                    createdBy={profile?.id || user?.id || ''}
                    onClose={() => setScheduleGroup(null)}
                    onSuccess={(meetingId) => navigate(`${basePath}/${meetingId}`)}
                />
            )}

            {isGroupModalOpen && (
                <GroupModal
                    programs={programs}
                    facilitators={facilitators}
                    editingGroup={editingGroup}
                    onClose={() => {
                        setIsGroupModalOpen(false);
                        setEditingGroup(null);
                    }}
                    onSuccess={() => {
                        setIsGroupModalOpen(false);
                        setEditingGroup(null);
                        fetchMyGroups();
                    }}
                />
            )}

            {deletingGroup && (
                <DeleteConfirmationModal
                    group={deletingGroup}
                    onClose={() => setDeletingGroup(null)}
                    onConfirm={async () => {
                        await deleteGroup(deletingGroup.id);
                        setDeletingGroup(null);
                        fetchMyGroups();
                    }}
                />
            )}

            {manageGroup && (
                <ManageMembersModal
                    group={manageGroup}
                    onClose={() => setManageGroup(null)}
                    onSave={() => {
                        setManageGroup(null);
                        fetchMyGroups();
                    }}
                />
            )}
        </div>
    );
}

// ─── Manage Members Modal ────────────────────────────────────────────────────
function ManageMembersModal({ group, onClose, onSave }: { group: CellGroup, onClose: () => void, onSave: () => void }) {
    const { organization } = useOrganization();
    const { profile } = useAuth();
    const [members, setMembers] = useState<any[]>([]);
    const [availableUsers, setAvailableUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchMembers();
    }, []);

    const calculateAge = (dob: string | null) => {
        if (!dob) return null;
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    };

    const fetchMembers = async () => {
        setLoading(true);
        try {
            // 1. Get current members of THIS group
            const { data: currentMembers } = await supabase
                .from('group_members')
                .select(`id, user_id, users (id, first_name, surname, email, dob, gender)`)
                .eq('group_id', group.id);

            setMembers(currentMembers || []);

            // 2. Get ALL participants in the organization
            const { data: allUsers } = await supabase
                .from('users')
                .select('id, first_name, surname, email, role, dob, gender')
                .eq('organization_id', organization!.id)
                .eq('role', 'participant');

            // 3. Get ALL group IDs + names for this specific program to check for existing assignments
            const { data: programGroups } = await supabase
                .from('program_groups')
                .select('id, name')
                .eq('program_id', (group as any).program_id);

            const programGroupMap: Record<string, string> = {};
            (programGroups || []).forEach(g => { programGroupMap[g.id] = g.name; });
            const programGroupIds = Object.keys(programGroupMap);

            // 4. Fetch ALL memberships for this program
            const { data: allProgramMemberships } = await supabase
                .from('group_members')
                .select('user_id, group_id')
                .in('group_id', programGroupIds);

            // Create a map of user_id -> group_name for assigned users
            const assignedUserMap: Record<string, string> = {};
            (allProgramMemberships || []).forEach(m => {
                assignedUserMap[m.user_id] = programGroupMap[m.group_id];
            });
            
            // 5. Available = All participants, marked with assignment status
            const available = (allUsers || []).map(u => ({
                ...u,
                alreadyInGroup: assignedUserMap[u.id] || null
            }));

            setAvailableUsers(available);
        } catch (err) {
            console.error('Error fetching members:', err);
        } finally {
            setLoading(false);
        }
    };

    const addToGroup = async (userId: string) => {
        setAdding(true);
        try {
            // Double-check one last time to prevent concurrency issues/double-assignment
            const { data: programGroups } = await supabase
                .from('program_groups')
                .select('id')
                .eq('program_id', (group as any).program_id);

            const programGroupIds = (programGroups || []).map(g => g.id);

            const { data: existing } = await supabase
                .from('group_members')
                .select('id')
                .eq('user_id', userId)
                .in('group_id', programGroupIds)
                .maybeSingle();

            if (existing) {
                throw new Error('This participant is already assigned to a group in this program. A participant can only be in one group per program.');
            }

            const targetOrgId = organization?.id || profile?.organization_id;
            if (!targetOrgId) {
                alert('Organization context is missing. Please refresh and try again.');
                setAdding(false);
                return;
            }

            const { error } = await supabase
                .from('group_members')
                .insert([{
                    group_id: group.id,
                    user_id: userId,
                    organization_id: targetOrgId
                }]);

            if (error) throw error;
            fetchMembers();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setAdding(false);
        }
    };

    const removeFromGroup = async (membershipId: string) => {
        try {
            const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('id', membershipId);

            if (error) throw error;
            fetchMembers();
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface border border-surface-border rounded-[32px] w-full max-w-2xl p-10 shadow-2xl relative max-h-[85vh] flex flex-col"
            >
                <div className="flex justify-between items-center mb-8 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none mb-1">Cell Membership</h2>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">{group.name}</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} className="p-2 shrink-0"><X className="w-6 h-6" /></Button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-8 scrollbar-hide">
                    {/* Current Members */}
                    <section>
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-4 px-2">Current Members ({members.length})</h3>
                        {loading ? (
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        ) : members.length === 0 ? (
                            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center py-6 border border-dashed border-surface-border rounded-2xl">No members assigned yet</p>
                        ) : (
                            <div className="space-y-2">
                                {members.map((m: any) => (
                                    <div key={m.id} className="bg-background border border-surface-border rounded-2xl px-5 py-4 flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center font-black text-[10px] text-emerald-400">
                                            {(m.users?.first_name?.[0] || '') + (m.users?.surname?.[0] || '')}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-foreground uppercase">
                                                {m.users?.first_name} {m.users?.surname}
                                                <span className="ml-2 text-[9px] text-primary/60 font-black">
                                                    {calculateAge(m.users?.dob) ? `${calculateAge(m.users?.dob)}Y` : ''} 
                                                    {m.users?.gender ? ` | ${m.users.gender.toUpperCase()}` : ''}
                                                </span>
                                            </p>
                                            <p className="text-[9px] font-black text-slate-600 truncate">{m.users?.email}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" className="text-rose-400 hover:text-rose-300 h-8 px-2" onClick={() => removeFromGroup(m.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Available to Add */}
                    <section>
                        <div className="flex items-center justify-between mb-3 px-2">
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-primary">Add Participants</h3>
                            <p className="text-[9px] font-black text-slate-600 uppercase">{availableUsers.length} unassigned</p>
                        </div>
                        {/* Search */}
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name..."
                                className="w-full h-11 bg-background border border-surface-border rounded-xl pl-10 pr-4 text-foreground text-sm font-bold outline-none focus:border-primary/40 transition-all"
                            />
                        </div>
                        {(() => {
                            const filtered = availableUsers.filter(u =>
                                `${u.first_name} ${u.surname}`.toLowerCase().includes(search.toLowerCase())
                            ).slice(0, 5);

                            return filtered.length === 0 ? (
                                <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest text-center py-6">
                                    {search ? 'No matches found' : 'No participants found'}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {filtered.map((u: any) => {
                                        const isAlreadyInGroup = !!u.alreadyInGroup;
                                        return (
                                            <button
                                                key={u.id}
                                                onClick={() => !isAlreadyInGroup && addToGroup(u.id)}
                                                disabled={adding || isAlreadyInGroup}
                                                className={`w-full h-12 px-4 bg-background border border-surface-border rounded-2xl flex items-center gap-3 text-left group transition-all ${
                                                    isAlreadyInGroup ? 'opacity-40 cursor-not-allowed' : 'hover:border-primary/40'
                                                }`}
                                            >
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 transition-colors ${
                                                    isAlreadyInGroup ? 'bg-slate-500/10 text-slate-400' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                                                }`}>
                                                    {isAlreadyInGroup ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-[11px] font-black uppercase truncate ${isAlreadyInGroup ? 'text-slate-500 line-through' : 'text-foreground'}`}>
                                                        {u.first_name} {u.surname}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isAlreadyInGroup ? 'bg-slate-500/10 text-slate-500' : 'bg-primary/10 text-primary'}`}>
                                                            {calculateAge(u.dob) !== null ? `Age: ${calculateAge(u.dob)}` : 'Age: N/A'}
                                                        </span>
                                                        {u.gender && (
                                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                • {u.gender}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isAlreadyInGroup && (
                                                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest leading-none mt-0.5">
                                                            Already in: {u.alreadyInGroup}
                                                        </p>
                                                    )}
                                                </div>
                                                {!isAlreadyInGroup && (
                                                    <Plus className="w-3.5 h-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all" />
                                                )}
                                            </button>
                                        );
                                    })}
                                    {!search && availableUsers.length > 5 && (
                                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center pt-2">
                                            +{availableUsers.length - 5} more — search to find them
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </section>
                </div>

                {/* Footer Save Button */}
                <div className="shrink-0 pt-6 mt-4 border-t border-surface-border flex gap-3">
                    <Button variant="ghost" onClick={onClose} className="flex-1 font-black text-[10px] uppercase tracking-widest">Cancel</Button>
                    <Button variant="united" onClick={onSave} className="flex-1 h-12 font-black text-[10px] uppercase tracking-widest">
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Save &amp; Close
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Delete Confirmation Modal ───────────────────────────────────────────────
function DeleteConfirmationModal({ group, onClose, onConfirm }: { group: CellGroup, onClose: () => void, onConfirm: () => void }) {
    const [loading, setLoading] = useState(false);

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl">
            <motion.div
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface border border-surface-border rounded-[32px] w-full max-w-sm p-10 shadow-2xl text-center"
            >
                <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 w-fit mx-auto mb-6">
                    <AlertTriangle className="w-10 h-10 text-rose-500" />
                </div>
                <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-2">Delete Cell Group?</h2>
                <p className="text-slate-400 text-xs font-bold leading-relaxed mb-8 uppercase tracking-widest">
                    This will permanently remove <span className="text-foreground">"{group.name}"</span> and all its linked meeting history. 
                    Participants will be unassigned but not deleted.
                </p>

                <div className="flex flex-col gap-3">
                    <Button 
                        variant="premium" 
                        className="h-14 bg-rose-500 hover:bg-rose-400 border-rose-500 font-black uppercase tracking-widest text-[11px]"
                        onClick={async () => {
                            setLoading(true);
                            await onConfirm();
                            setLoading(false);
                        }}
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Permanent'}
                    </Button>
                    <Button variant="ghost" onClick={onClose} disabled={loading} className="font-black text-[10px] uppercase tracking-widest">Cancel / Go Back</Button>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Group Modal (Create/Edit) ───────────────────────────────────────────────
function GroupModal({ programs, facilitators, editingGroup, onClose, onSuccess }: { 
    programs: any[], 
    facilitators: any[], 
    editingGroup: CellGroup | null,
    onClose: () => void, 
    onSuccess: () => void 
}) {
    const { organization } = useOrganization();
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(editingGroup?.name || '');
    const [description, setDescription] = useState(editingGroup?.description || '');
    const [programId, setProgramId] = useState(editingGroup?.program_id || programs[0]?.id || '');
    const [facilitatorId, setFacilitatorId] = useState(editingGroup?.facilitator_id || '');
    const [secondFacilitatorId, setSecondFacilitatorId] = useState(editingGroup?.second_facilitator_id || '');
    const [maxCapacity, setMaxCapacity] = useState(editingGroup?.max_capacity || 12);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const targetOrgId = organization?.id || profile?.organization_id;
        if (!targetOrgId) {
            alert('Organization context is missing. Please refresh and try again.');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                organization_id: targetOrgId,
                program_id: programId,
                name,
                description,
                max_capacity: maxCapacity,
                facilitator_id: facilitatorId || null,
                second_facilitator_id: secondFacilitatorId || null
            };

            if (editingGroup) {
                const { error } = await supabase
                    .from('program_groups')
                    .update(payload)
                    .eq('id', editingGroup.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('program_groups')
                    .insert([payload]);
                if (error) throw error;
            }

            onSuccess();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-surface border border-surface-border rounded-[32px] w-full max-w-lg p-10 shadow-2xl relative"
            >
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-foreground uppercase tracking-tight leading-none mb-1">Create Group</h2>
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">New Organizational Unit</p>
                    </div>
                    <Button variant="ghost" onClick={onClose} className="p-2"><X className="w-6 h-6" /></Button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Group Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="e.g. Wednesday Night Fellowship"
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-primary/40 transition-all font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Description</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="What is this group about?"
                            rows={3}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm outline-none focus:border-primary/40 transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Target Program</label>
                            <select
                                required
                                value={programId}
                                onChange={e => setProgramId(e.target.value)}
                                className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm font-bold focus:border-primary/40 outline-none"
                            >
                                <option value="">Select Program...</option>
                                {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Capacity</label>
                            <input
                                type="number"
                                value={maxCapacity}
                                onChange={e => setMaxCapacity(parseInt(e.target.value))}
                                className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm font-bold focus:border-primary/40 outline-none"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-primary">Main Facilitator</label>
                            <select
                                value={facilitatorId}
                                onChange={e => setFacilitatorId(e.target.value)}
                                className="w-full bg-background border border-primary/20 rounded-xl px-4 py-3 text-foreground text-sm font-bold focus:border-primary/40 outline-none"
                            >
                                <option value="">No assignment</option>
                                {facilitators.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.first_name} {f.surname}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 text-slate-400">Co-Facilitator</label>
                            <select
                                value={secondFacilitatorId}
                                onChange={e => setSecondFacilitatorId(e.target.value)}
                                className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm font-bold focus:border-primary/40 outline-none"
                            >
                                <option value="">No assignment</option>
                                {facilitators.map(f => (
                                    <option key={f.id} value={f.id}>
                                        {f.first_name} {f.surname}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <Button
                        type="submit"
                        variant="premium"
                        className="w-full h-14 font-black uppercase tracking-widest text-[11px]"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingGroup ? 'Save Changes' : 'Confirm Creation')}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}

// ─── Schedule Meeting Modal ────────────────────────────────────────────────────
function ScheduleMeetingModal({
    group, organizationId, createdBy, onClose, onSuccess
}: {
    group: CellGroup;
    organizationId: string;
    createdBy: string;
    onClose: () => void;
    onSuccess: (meetingId: string) => void;
}) {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [time, setTime] = useState('18:00');
    const [venue, setVenue] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const formattedDate = new Date(date).toLocaleDateString('en-ZA', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            const { data, error: err } = await supabase
                .from('cell_meetings')
                .insert([{
                    group_id: group.id,
                    organization_id: organizationId,
                    scheduled_date: date,
                    meeting_time: time,
                    title: `${group.name} — ${formattedDate}`,
                    venue: venue || null,
                    notes: notes || null,
                    status: 'open',
                    created_by: createdBy,
                }])
                .select()
                .single();

            if (err) throw err;
            onSuccess(data.id);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-surface border border-surface-border rounded-3xl w-full max-w-md p-8 shadow-2xl relative"
            >
                <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-foreground transition-colors">
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-8">
                    <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 w-fit mb-4">
                        <CalendarPlus className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-2xl font-black text-foreground uppercase tracking-tight">Schedule Meeting</h3>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-1">{group.name}</p>
                    <p className="text-slate-400 text-xs mt-2">
                        Set the date and time agreed by your group — this meeting is independent of any program session.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            <Calendar className="w-3 h-3 inline mr-1.5" /> Meeting Date
                        </label>
                        <input
                            type="date"
                            required
                            value={date}
                            min={today}
                            onChange={e => setDate(e.target.value)}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground font-black text-sm outline-none focus:border-primary/40 transition-all shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            <Clock className="w-3 h-3 inline mr-1.5" /> Meeting Time
                        </label>
                        <input
                            type="time"
                            required
                            value={time}
                            onChange={e => setTime(e.target.value)}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground font-black text-sm outline-none focus:border-primary/40 transition-all shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            <MapPin className="w-3 h-3 inline mr-1.5" /> Venue (optional)
                        </label>
                        <input
                            type="text"
                            value={venue}
                            onChange={e => setVenue(e.target.value)}
                            placeholder="e.g. 12 Oak Street or Host's home"
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground font-black text-sm outline-none focus:border-primary/40 transition-all shadow-inner"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Notes (optional)
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Study topic, reminder, etc."
                            rows={3}
                            className="w-full bg-background border border-surface-border rounded-xl px-4 py-3 text-foreground text-sm font-bold focus:border-primary/40 outline-none transition-all resize-none shadow-inner"
                        />
                    </div>

                    {error && (
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">{error}</p>
                    )}

                    <Button
                        type="submit"
                        variant="premium"
                        className="w-full h-14 font-black uppercase tracking-widest text-[11px]"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Open Register'}
                    </Button>
                </form>
            </motion.div>
        </div>
    );
}
