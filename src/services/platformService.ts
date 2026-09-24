import { supabase } from './supabase';
import { Organization } from '@/types';
import { organizationService } from './organizationService';

export const platformService = {
    /**
     * Create a new organization from platform management.
     */
    async createOrganization(org: {
        name: string;
        slug: string;
        contact_email: string;
        primary_color?: string;
        secondary_color?: string;
        join_code?: string;
    }) {
        const join_code = org.join_code || organizationService.generateJoinCode();
        const { data, error } = await supabase
            .from('organizations')
            .insert([{
                name: org.name,
                slug: org.slug,
                contact_email: org.contact_email,
                primary_color: org.primary_color || '#6366f1',
                secondary_color: org.secondary_color || '#ec4899',
                join_code,
                is_active: true
            }])
            .select()
            .single();

        if (error) {
            console.error('PlatformService: Error creating organization:', error);
            if (error.code === '23505') {
                throw new Error('An organization with this name or slug already exists.');
            }
            throw error;
        }
        return data;
    },

    /**
     * Fetch all organizations across the platform.
     * This bypasses the typical organization-level filters.
     */
    async getAllOrganizations() {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('PlatformService: Error fetching organizations:', error);
            throw error;
        }
        return data;
    },

    /**
     * Update an organization's status (active/suspended).
     */
    async updateOrganizationStatus(
        orgId: string,
        status: {
            is_active?: boolean;
            is_suspended?: boolean;
            suspended_reason?: string | null
        }
    ) {
        const updates: any = { ...status, updated_at: new Date().toISOString() };

        // If suspending, also deactivate
        if (status.is_suspended === true) {
            updates.is_active = false;
            updates.suspended_at = new Date().toISOString();
        } else if (status.is_suspended === false) {
            updates.is_active = true;
            updates.suspended_at = null;
            updates.suspended_reason = null;
        }

        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', orgId)
            .select()
            .single();

        if (error) {
            console.error('PlatformService: Error updating organization status:', error);
            throw error;
        }
        return data;
    },

    /**
     * Update an organization's details.
     */
    async updateOrganization(orgId: string, updates: Partial<Organization>) {
        const { data, error } = await supabase
            .from('organizations')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', orgId)
            .select()
            .single();

        if (error) {
            console.error('PlatformService: Error updating organization:', error);
            throw error;
        }
        return data;
    },

    /**
     * Delete an organization and all its data.
     * Note: This relies on CASCADE DELETE in the database schema.
     */
    async deleteOrganization(orgId: string) {
        const { error } = await supabase
            .from('organizations')
            .delete()
            .eq('id', orgId);

        if (error) {
            console.error('PlatformService: Error deleting organization:', error);
            throw error;
        }
    },

    /**
     * Fetch all administrators for a specific organization.
     * Useful for choosing an impersonation target.
     */
    async getOrgAdmins(orgId: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('organization_id', orgId)
            .in('role', ['system_admin', 'program_admin']);

        if (error) {
            console.error('PlatformService: Error fetching organization admins:', error);
            throw error;
        }
        return data;
    },

    /**
     * Fetch platform-wide statistics for the dashboard.
     */
    async getPlatformStats() {
        const [orgs, users, programs] = await Promise.all([
            supabase.from('organizations').select('*', { count: 'exact', head: true }),
            supabase.from('users').select('*', { count: 'exact', head: true }),
            supabase.from('programs').select('*', { count: 'exact', head: true })
        ]);

        return {
            totalOrganizations: orgs.count || 0,
            totalUsers: users.count || 0,
            totalPrograms: programs.count || 0
        };
    }
};
