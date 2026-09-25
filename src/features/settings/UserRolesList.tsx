import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { useOrganization } from '@/hooks/useOrganization';
import { GlassBox } from '@/components/ui/Card';
import { Loader2, Search, Users, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

type UserRole = 'platform_admin' | 'system_admin' | 'program_admin' | 'facilitator' | 'participant';

interface OrgUser {
    id: string;
    first_name: string;
    surname: string;
    email: string;
    role: UserRole;
    created_at: string;
}

const ROLE_COLORS: Record<UserRole, string> = {
    platform_admin: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    system_admin: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    program_admin: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    facilitator: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    participant: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const ALL_ROLES: UserRole[] = ['system_admin', 'program_admin', 'facilitator', 'participant'];

export function UserRolesList() {
    const { organization } = useOrganization();
    const [users, setUsers] = useState<OrgUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState<UserRole | 'all'>('all');
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    useEffect(() => {
        if (organization?.id) {
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [organization?.id]);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, first_name, surname, email, role, created_at')
                .eq('organization_id', organization!.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error('Error fetching users:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId: string, newRole: UserRole) => {
        setUpdatingId(userId);
        try {
            const { error } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId);

            if (error) throw error;
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (err) {
            console.error('Error updating role:', err);
        } finally {
            setUpdatingId(null);
        }
    };

    const filtered = users.filter(u => {
        const matchesSearch =
            u.first_name?.toLowerCase().includes(search.toLowerCase()) ||
            u.surname?.toLowerCase().includes(search.toLowerCase()) ||
            u.email?.toLowerCase().includes(search.toLowerCase());
        const matchesRole = filterRole === 'all' || u.role === filterRole;
        return matchesSearch && matchesRole;
    });

    const roleCounts = ALL_ROLES.reduce((acc, r) => {
        acc[r] = users.filter(u => u.role === r).length;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-8">
            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {ALL_ROLES.map(role => (
                    <button
                        key={role}
                        onClick={() => setFilterRole(filterRole === role ? 'all' : role)}
                        className={`p-4 rounded-2xl border text-left transition-all ${filterRole === role ? ROLE_COLORS[role] + ' border-current' : 'bg-surface border-surface-border hover:border-primary/30'}`}
                    >
                        <p className="text-2xl font-black text-foreground">{roleCounts[role] || 0}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest mt-1 text-slate-500">
                            {role.replace('_', ' ')}
                        </p>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                    type="text"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-background border border-surface-border rounded-2xl text-sm text-foreground outline-none focus:border-primary/40 transition-all"
                />
            </div>

            {/* List */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-surface-border rounded-3xl">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">No users found</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.map((user, i) => (
                        <motion.div
                            key={user.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="bg-surface border border-surface-border rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-primary/20 transition-all"
                        >
                            {/* Avatar */}
                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black text-xs text-primary shrink-0 uppercase">
                                {(user.first_name?.[0] || '') + (user.surname?.[0] || '')}
                            </div>

                            {/* Name + Email */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-black text-foreground uppercase tracking-tight truncate">
                                    {user.first_name} {user.surname}
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold truncate">{user.email}</p>
                            </div>

                            {/* Joined */}
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0 hidden md:block">
                                {new Date(user.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </p>

                            {/* Role Selector */}
                            <div className="relative shrink-0">
                                <span className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${ROLE_COLORS[user.role]}`}>
                                    {user.role.replace('_', ' ')}
                                    {updatingId === user.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                </span>
                                {user.role !== 'platform_admin' && (
                                    <select
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full"
                                        value={user.role}
                                        disabled={updatingId === user.id}
                                        onChange={e => handleRoleChange(user.id, e.target.value as UserRole)}
                                    >
                                        {ALL_ROLES.map(r => (
                                            <option key={r} value={r}>{r.replace('_', ' ')}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center">
                {filtered.length} of {users.length} users · click a role badge to change it
            </p>
        </div>
    );
}
