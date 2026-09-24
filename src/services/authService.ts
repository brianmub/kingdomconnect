import { supabase } from './supabase';
import { organizationService } from './organizationService';

export function formatAuthError(error: any): string {
    if (!error) return 'An unexpected error occurred.';
    const msg = error.message || error.details || String(error);
    if (
        msg.includes('Failed to fetch') ||
        msg.includes('fetch failed') ||
        msg.includes('NetworkError') ||
        msg.includes('ENOTFOUND')
    ) {
        return 'Unable to reach the database server. Your Supabase project may be paused or offline. Please unpause it in your Supabase dashboard or check your connection.';
    }
    return msg;
}

export const authService = {
    async signIn(email: string, password: string) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            return data;
        } catch (error: any) {
            throw new Error(formatAuthError(error));
        }
    },

    async checkSlugAvailability(slug: string) {
        try {
            const { data, error } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();

            if (error) {
                console.error('Error checking slug availability:', error);
                throw new Error(formatAuthError(error));
            }
            return !data;
        } catch (err: any) {
            console.error('Availability check exception:', err);
            throw new Error(formatAuthError(err));
        }
    },

    async signUp(formData: any) {
        try {
            // 1. Create Organization with generated join_code
            const joinCode = organizationService.generateJoinCode();
            const { data: org, error: orgError } = await supabase
                .from('organizations')
                .insert([{
                    name: formData.orgName,
                    slug: formData.orgSlug,
                    primary_color: formData.primaryColor,
                    secondary_color: formData.secondaryColor,
                    contact_email: formData.adminEmail,
                    join_code: joinCode,
                    is_active: true
                }])
                .select()
                .single();

            if (orgError) {
                if (orgError.code === '23505') {
                    throw new Error('An organization with this name or slug already exists. Please choose a different name.');
                }
                throw orgError;
            }

            // 2. Sign up User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.adminEmail,
                password: formData.password,
            });

            if (authError) {
                // Rollback org creation if possible (or handle error)
                await supabase.from('organizations').delete().eq('id', org.id);
                throw authError;
            }

            if (authData.user) {
                // 3. Create User Profile
                const { error: profileError } = await supabase
                    .from('users')
                    .insert([{
                        // id: auto-generated
                        auth_id: authData.user.id,
                        organization_id: org.id,
                        email: formData.adminEmail,
                        first_name: formData.adminName.trim().split(' ')[0],
                        surname: formData.adminName.trim().split(' ').slice(1).join(' ') || 'Admin',
                        role: 'system_admin',
                        is_active: true
                    }]);

                if (profileError) {
                    // Critical: Rollback user and org if profile fails
                    console.error('Profile creation failed, rolling back...', profileError);
                    await supabase.from('organizations').delete().eq('id', org.id);
                    throw new Error('Failed to create user profile. Please try again.');
                }
            }

            return { user: authData.user, organization: org };
        } catch (err: any) {
            throw new Error(formatAuthError(err));
        }
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    }
};
