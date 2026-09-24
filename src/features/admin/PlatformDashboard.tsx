import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Layout, ShieldCheck, Search, Filter, MoreVertical, Ban, CheckCircle, ExternalLink, Trash2, Pencil, X, AlertTriangle, Loader2, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlassBox, Card } from '@/components/ui/Card';
import { platformService } from '@/services/platformService';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Organization } from '@/types';
import { format } from 'date-fns';

export function PlatformDashboard() {
    const { impersonateUser } = useAuth();
    const { switchOrganization } = useOrganization();
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingOrg, setEditingOrg] = useState<any>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deletingOrg, setDeletingOrg] = useState<any>(null);
    const [saveLoading, setSaveLoading] = useState(false);

    // Create Organization Modal State
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newOrg, setNewOrg] = useState({
        name: '',
        slug: '',
        contact_email: '',
        primary_color: '#6366f1',
        secondary_color: '#ec4899',
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [orgsData, statsData] = await Promise.all([
                platformService.getAllOrganizations(),
                platformService.getPlatformStats()
            ]);
            setOrganizations(orgsData);
            setStats(statsData);
        } catch (error) {
            console.error('Error loading platform data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (org: Organization) => {
        try {
            const newStatus = {
                is_suspended: !org.is_suspended,
                is_active: org.is_suspended // If was suspended, activate it
            };
            await platformService.updateOrganizationStatus(org.id, newStatus);
            await loadData(); // Refresh
        } catch (error) {
            console.error('Error toggling org status:', error);
        }
    };

    const handleImpersonate = async (org: Organization) => {
        try {
            const admins = await platformService.getOrgAdmins(org.id);
            if (admins && admins.length > 0) {
                // For simplicity, impersonate the first admin found
                impersonateUser(admins[0]);
                await switchOrganization(org.slug);
                window.location.href = '/dashboard'; // Force redirect to dashboard
            } else {
                alert('No admin users found in this organization to impersonate.');
            }
        } catch (error) {
            console.error('Impersonation failed:', error);
        }
    };

    const handleCreateOrg = async () => {
        if (!newOrg.name.trim() || !newOrg.slug.trim() || !newOrg.contact_email.trim()) {
            setCreateError('Name, slug, and contact email are required.');
            return;
        }
        try {
            setCreateLoading(true);
            setCreateError(null);
            await platformService.createOrganization(newOrg);
            setIsCreateModalOpen(false);
            setNewOrg({
                name: '',
                slug: '',
                contact_email: '',
                primary_color: '#6366f1',
                secondary_color: '#ec4899',
            });
            await loadData();
        } catch (error: any) {
            console.error('Error creating organization:', error);
            setCreateError(error.message || 'Failed to create organization');
        } finally {
            setCreateLoading(false);
        }
    };

    const handleEdit = (org: any) => {
        setEditingOrg({ ...org });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingOrg) return;
        try {
            setSaveLoading(true);
            await platformService.updateOrganization(editingOrg.id, {
                name: editingOrg.name,
                slug: editingOrg.slug,
                contact_email: editingOrg.contact_email
            });
            setIsEditModalOpen(false);
            await loadData();
        } catch (error) {
            console.error('Error saving organization:', error);
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDelete = async (org: any) => {
        setDeletingOrg(org);
    };

    const confirmDelete = async () => {
        if (!deletingOrg) return;
        try {
            setIsDeleting(true);
            await platformService.deleteOrganization(deletingOrg.id);
            setDeletingOrg(null);
            await loadData();
        } catch (error) {
            console.error('Error deleting organization:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredOrgs = organizations.filter(org =>
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return (
        <div className="flex items-center justify-center p-20">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="space-y-8 p-8">
            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-4xl font-black text-foreground uppercase tracking-tight">Platform Command</h1>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-2">Global Organization Management</p>
                </div>
                <div className="flex items-center space-x-6">
                    <div className="text-right">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">System Integrity</div>
                        <div className="flex items-center text-emerald-500 text-xs font-black uppercase">
                            <ShieldCheck className="w-4 h-4 mr-1" /> All Systems Nominal
                        </div>
                    </div>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: 'Total Organizations', value: stats?.totalOrganizations, icon: <Building2 />, color: 'indigo' },
                    { label: 'Total Active Users', value: stats?.totalUsers, icon: <Users />, color: 'emerald' },
                    { label: 'Global Programs', value: stats?.totalPrograms, icon: <Layout />, color: 'amber' }
                ].map((stat, i) => (
                    <GlassBox key={i} className="p-6 border-surface-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</p>
                                <h3 className="text-3xl font-black text-foreground">{stat.value}</h3>
                            </div>
                            <div className={`p-4 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-500`}>
                                {stat.icon}
                            </div>
                        </div>
                    </GlassBox>
                ))}
            </div>

            {/* Org Management List */}
            <Card className="border-surface-border overflow-hidden">
                <div className="p-6 border-b border-surface-border bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by Name or Slug..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 rounded-xl border border-surface-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="text-xs font-black uppercase tracking-widest bg-background border-surface-border" onClick={loadData}>
                            Refresh Data
                        </Button>
                        <Button
                            variant="premium"
                            className="text-xs font-black uppercase tracking-widest gap-2"
                            onClick={() => {
                                setCreateError(null);
                                setIsCreateModalOpen(true);
                            }}
                        >
                            <Plus className="w-4 h-4" /> Create Organization
                        </Button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50 border-b border-surface-border">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Organization</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Slug</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Contact</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-border">
                            {filteredOrgs.map((org: any) => (
                                <tr key={org.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-500 border border-surface-border group-hover:bg-white transition-colors">
                                                {org.name.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-black text-sm text-foreground uppercase tracking-tight">{org.name}</div>
                                                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                                    Member since {format(new Date(org.created_at), 'MMM yyyy')}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5">
                                        <code className="px-2 py-1 rounded bg-slate-100 text-[11px] font-mono font-bold text-slate-600">
                                            {org.slug}
                                        </code>
                                    </td>
                                    <td className="px-6 py-5">
                                        <div className="text-sm font-bold text-slate-600">{org.contact_email}</div>
                                    </td>
                                    <td className="px-6 py-5">
                                        {org.is_suspended ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest">
                                                <Ban className="w-3 h-3 mr-1" /> Suspended
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-black uppercase tracking-widest">
                                                <CheckCircle className="w-3 h-3 mr-1" /> Active
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end space-x-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 text-[10px] font-black uppercase tracking-widest gap-2 bg-background border-surface-border hover:bg-slate-50"
                                                onClick={() => handleImpersonate(org)}
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" /> Impersonate
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 w-9 p-0 border border-surface-border text-slate-600 hover:bg-slate-50"
                                                onClick={() => handleEdit(org)}
                                                title="Edit Organization"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={`h-9 w-9 p-0 border border-surface-border ${org.is_suspended ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'}`}
                                                onClick={() => handleToggleStatus(org)}
                                                title={org.is_suspended ? "Activate Organization" : "Suspend Organization"}
                                            >
                                                {org.is_suspended ? <CheckCircle className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-9 w-9 p-0 border border-surface-border text-red-500 hover:text-red-600 hover:bg-red-50"
                                                onClick={() => handleDelete(org)}
                                                title="Delete Organization"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredOrgs.length === 0 && (
                        <div className="p-20 text-center">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Search className="w-8 h-8 text-slate-300" />
                            </div>
                            <h4 className="text-lg font-black text-foreground uppercase tracking-tight">No Organizations Found</h4>
                            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mt-1">Try adjusting your search filters</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* Create Organization Modal */}
            <AnimatePresence>
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-background w-full max-w-lg rounded-3xl border border-surface-border shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-surface-border flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                        <Building2 className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-foreground uppercase tracking-tight">Create Organization</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Provision a new ministry or tenant</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {createError && (
                                <div className="mx-8 mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{createError}</span>
                                </div>
                            )}

                            <div className="p-8 space-y-5">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Organization Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Grace Fellowship"
                                        value={newOrg.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            const autoSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                                            setNewOrg(prev => ({
                                                ...prev,
                                                name,
                                                slug: prev.slug === '' || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]/g, '') ? autoSlug : prev.slug
                                            }));
                                        }}
                                        className="w-full px-4 py-3 rounded-xl border border-surface-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">System Slug</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. gracefellowship"
                                        value={newOrg.slug}
                                        onChange={(e) => setNewOrg(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') }))}
                                        className="w-full px-4 py-3 rounded-xl border border-surface-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Administrator Contact Email</label>
                                    <input
                                        type="email"
                                        placeholder="admin@example.com"
                                        value={newOrg.contact_email}
                                        onChange={(e) => setNewOrg(prev => ({ ...prev, contact_email: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-xl border border-surface-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Primary Color</label>
                                        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-surface-border">
                                            <input
                                                type="color"
                                                value={newOrg.primary_color}
                                                onChange={(e) => setNewOrg(prev => ({ ...prev, primary_color: e.target.value }))}
                                                className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent"
                                            />
                                            <span className="text-xs font-mono font-bold text-slate-600">{newOrg.primary_color}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Secondary Color</label>
                                        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-surface-border">
                                            <input
                                                type="color"
                                                value={newOrg.secondary_color}
                                                onChange={(e) => setNewOrg(prev => ({ ...prev, secondary_color: e.target.value }))}
                                                className="w-8 h-8 rounded-lg cursor-pointer border-none bg-transparent"
                                            />
                                            <span className="text-xs font-mono font-bold text-slate-600">{newOrg.secondary_color}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-surface-border flex gap-3">
                                <Button variant="outline" className="flex-1 font-black uppercase tracking-widest border-surface-border" onClick={() => setIsCreateModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="premium" className="flex-1 font-black uppercase tracking-widest" onClick={handleCreateOrg} disabled={createLoading}>
                                    {createLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Organization'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Modal */}
            <AnimatePresence>
                {isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-background w-full max-w-lg rounded-3xl border border-surface-border shadow-2xl overflow-hidden"
                        >
                            <div className="p-6 border-b border-surface-border flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-primary/10 rounded-xl text-primary">
                                        <Pencil className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-foreground uppercase tracking-tight">Edit Organization</h3>
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Update core identities</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Organization Name</label>
                                    <input
                                        type="text"
                                        value={editingOrg?.name || ''}
                                        onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-surface-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">System Slug (Careful)</label>
                                    <input
                                        type="text"
                                        value={editingOrg?.slug || ''}
                                        onChange={(e) => setEditingOrg({ ...editingOrg, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
                                        className="w-full px-4 py-3 rounded-xl border border-surface-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">Contact Email</label>
                                    <input
                                        type="email"
                                        value={editingOrg?.contact_email || ''}
                                        onChange={(e) => setEditingOrg({ ...editingOrg, contact_email: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-surface-border bg-background focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                                    />
                                </div>
                            </div>

                            <div className="p-6 bg-slate-50/50 border-t border-surface-border flex gap-3">
                                <Button variant="outline" className="flex-1 font-black uppercase tracking-widest border-surface-border" onClick={() => setIsEditModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button variant="premium" className="flex-1 font-black uppercase tracking-widest" onClick={handleSaveEdit} disabled={saveLoading}>
                                    {saveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Delete Confirmation */}
            <AnimatePresence>
                {deletingOrg && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="bg-background w-full max-w-md rounded-3xl border border-red-100 shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                                    <AlertTriangle className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black text-foreground uppercase tracking-tight mb-2">Authorize Deletion?</h3>
                                <p className="text-slate-500 text-sm font-bold">
                                    You are about to permanently delete <span className="text-foreground">{deletingOrg.name}</span>. This action is irreversible and will purge all data associated with this organization.
                                </p>
                            </div>

                            <div className="p-6 bg-red-50/50 border-t border-red-100 flex gap-3">
                                <Button variant="outline" className="flex-1 font-black uppercase tracking-widest border-red-100 text-red-600 hover:bg-red-50" onClick={() => setDeletingOrg(null)}>
                                    Abort
                                </Button>
                                <Button variant="ghost" className="flex-1 font-black uppercase tracking-widest bg-red-500 text-white hover:bg-red-600" onClick={confirmDelete} disabled={isDeleting}>
                                    {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Purge'}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
