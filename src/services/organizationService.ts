import { supabase } from './supabase';

export const organizationService = {
    async updateOrganization(id: string, updates: {
        name?: string;
        contact_email?: string;
        join_code?: string;
    }) {
        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating organization:', error);
            throw new Error(error.message);
        }

        return data;
    },

    async getOrganizationByJoinCode(code: string) {
        const { data, error } = await supabase
            .from('organizations')
            .select('id, name, slug, primary_color')
            .eq('is_active', true)
            .ilike('join_code', code)
            .single();

        if (error) {
            console.error('Error fetching organization by code:', error);
            return null;
        }

        return data;
    },

    async createOrganization(org: {
        name: string;
        slug: string;
        contact_email: string;
        primary_color?: string;
        secondary_color?: string;
        join_code?: string;
    }) {
        const join_code = org.join_code || this.generateJoinCode();
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
            console.error('Error creating organization:', error);
            throw new Error(error.message);
        }

        return data;
    },

    generateJoinCode() {
        // Generate a random 6-character uppercase alphanumeric code
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous characters (I, O, 0, 1, V, U)
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }
};
