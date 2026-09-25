import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Organization } from '@/types';
import { supabase } from '@/services/supabase';
import { TenantContext } from './TenantContextObject';
export { TenantContext };
import { useAuth } from '@/hooks/useAuth';

export function TenantProvider({ children }: { children: React.ReactNode }) {
    const { user, profiles, loading: authLoading } = useAuth();
    const [organization, setOrganization] = useState<Organization | null>(null);
    const [currentProfile, setCurrentProfile] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const fetchInProgress = useRef<string | null>(null);

    const getUrlSlug = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('org') || window.location.pathname.split('/portal/')[1]?.split('/')[0] || null;
    };

    const profileKey = profiles.map((p: any) => p.organization_id).join(',');
    
    useEffect(() => {
        const urlSlug = getUrlSlug();
        console.log('TenantContext: useEffect triggered. authLoading:', authLoading, 'urlSlug:', urlSlug);

        if (authLoading && !urlSlug) {
            return;
        }

        fetchOrg(urlSlug);
    }, [authLoading, profileKey]);

    const switchOrganization = async (newSlug: string) => {
        console.log('TenantContext: Switching organization to:', newSlug);
        localStorage.setItem('active_org_slug', newSlug);
        await fetchOrg(newSlug);
    };

    async function fetchOrg(slugOverride?: string | null) {
        const urlSlug = getUrlSlug();
        const effectiveSlug = slugOverride || urlSlug || localStorage.getItem('active_org_slug');
        
        const fetchKey = `${effectiveSlug}-${profiles?.length || 0}`;
        if (fetchInProgress.current === fetchKey && organization) return;
        fetchInProgress.current = fetchKey;

        console.log('TenantContext: fetchOrg starting. effectiveSlug:', effectiveSlug);
        
        // Background loading: Only show full screen loader if we don't have an organization yet
        // or if we are switching to a completely different slug
        const isSwitching = effectiveSlug && organization && organization.slug !== effectiveSlug;
        if (!organization || isSwitching) {
            setLoading(true);
        }

        try {
            let query = supabase.from('organizations').select('*');

            if (effectiveSlug) {
                query = query.eq('slug', effectiveSlug);
            } else if (profiles && profiles.length > 0) {
                const p = currentProfile || profiles[0];
                query = query.eq('id', p.organization_id);
            } else {
                console.log('TenantContext: No organization reference found yet.');
                setLoading(false);
                return;
            }

            const { data, error: fetchError } = await query.single();
            if (fetchError) throw fetchError;
            
            if (data) {
                console.log('TenantContext: Organization found:', data.name);
                setOrganization(prev => (prev?.id === data.id && prev?.slug === data.slug ? prev : (data as Organization)));
                localStorage.setItem('active_org_slug', data.slug);
                
                const match = profiles?.find(p => p.organization_id === data.id);
                if (match) {
                    setCurrentProfile((prev: any) => (prev?.id === match.id && prev?.role === match.role ? prev : match));
                }
            }
        } catch (err: any) {
            console.error('TenantContext: Error fetching organization:', err);
        } finally {
            setLoading(false);
        }
    }

    const isPublic = ['/', '/login', '/signup', '/register', '/forgot-password', '/invite'].some(p => 
        window.location.pathname === p || window.location.pathname === p + '/'
    );
    const isPortal = window.location.pathname.includes('/portal/');
    const isDashboard = window.location.pathname.startsWith('/dashboard');

    const shouldShowLoader = loading && (isPortal || isDashboard) && !organization;

    const contextValue = useMemo(() => ({ 
        organization, 
        currentProfile, 
        loading, 
        error, 
        switchOrganization 
    }), [organization, currentProfile, loading, error]);

    return (
        <TenantContext.Provider value={contextValue}>
            {shouldShowLoader ? (
                <div className="fixed inset-0 bg-background flex items-center justify-center z-[100]">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Connecting to Kingdom...</p>
                    </div>
                </div>
            ) : (
                children
            )}
        </TenantContext.Provider>
    );
}
