export type UserRole = 'platform_admin' | 'system_admin' | 'program_admin' | 'facilitator' | 'participant';

export interface Organization {
    id: string;
    name: string;
    slug: string;
    join_code?: string;
    logo_url?: string;
    description?: string;
    contact_email: string;
    contact_phone?: string;
    address?: string;
    city?: string;
    country?: string;
    timezone: string;
    default_currency: string;
    features_enabled: Record<string, any>;
    settings: {
        require_email_verification: boolean;
        allow_self_enrollment: boolean;
        enable_rsvp: boolean;
        enable_location_check: boolean;
        payment_methods: string[];
        notifications: {
            email: boolean;
            push: boolean;
            sms: boolean;
        };
    };
    is_active: boolean;
    is_suspended?: boolean;
    created_at: string;
    updated_at: string;
}

export interface UserProfile {
    id: string; // The row ID in users table
    auth_id?: string; // The Supabase Auth ID
    organization_id: string;
    email: string;
    role: UserRole;
    first_name: string;
    surname: string;
    middle_name?: string;
    salutation?: string;
    gender?: 'male' | 'female';
    marital_status?: 'single' | 'married' | 'widowed' | 'divorced';
    dob?: string;
    phone_number?: string;
    church_name?: string;
    residential_address?: string;
    suburb?: string;
    city_town?: string;
    province?: string;
    country?: string;
    profile_photo_url?: string;
    is_active: boolean;
    created_at: string;
}

export interface Program {
    id: string;
    organization_id: string;
    name: string;
    description?: string;
    category?: string;
    start_date: string;
    end_date?: string;
    enrollment_start_date?: string;
    enrollment_end_date?: string;
    enrollment_fee: number;
    session_fee: number;
    currency: string;
    max_participants?: number;
    attendance_required_pct: number;
    features: {
        certificates_enabled: boolean;
        badges_enabled: boolean;
        qr_checkin_required: boolean;
        payment_required: boolean;
        rsvp_enabled: boolean;
        approval_required: boolean;
    };
    status: 'draft' | 'active' | 'completed' | 'archived';
    image_url?: string;
    created_by?: string;
    created_at: string;
}

export interface Session {
    id: string;
    organization_id: string;
    program_id: string;
    name: string;
    description?: string;
    session_number?: number;
    session_date: string;
    start_time: string;
    end_time: string;
    location_type: 'physical' | 'virtual' | 'hybrid';
    location?: string;
    virtual_link?: string;
    session_fee?: number | null;
    is_paid?: boolean;
    currency?: string | null;
    payment_method?: string | null;
    payment_instructions?: string | null;
    qr_code_data: string;
    facilitator_id?: string;
    max_capacity?: number;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface Attendance {
    id: string;
    user_id: string;
    session_id: string;
    checked_in: boolean;
    checked_in_at?: string;
    checkin_method?: string;
    checked_out: boolean;
    checkout_time?: string;
    checkout_method?: string;
    duration_minutes?: number;
    status: 'present' | 'absent' | 'late' | 'excused';
}

export interface CellMeeting {
    id: string;
    group_id: string;
    organization_id: string;
    scheduled_date: string;
    title?: string;
    notes?: string;
    status: 'open' | 'closed';
    created_by?: string;
    created_at: string;
}

export interface CellAttendance {
    id: string;
    meeting_id: string;
    user_id: string;
    status: 'present' | 'absent' | 'excused';
    checkin_method?: 'qr' | 'manual';
    marked_at: string;
    marked_by?: string;
}

export interface Broadcast {
    id: string;
    organization_id: string;
    type: 'podcast' | 'news' | 'story';
    title: string;
    description?: string;
    media_url?: string;
    thumbnail_url?: string;
    is_published: boolean;
    published_at?: string;
    created_at: string;
}
