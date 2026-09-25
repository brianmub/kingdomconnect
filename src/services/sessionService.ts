import { supabase } from './supabase';
import { Session, Attendance } from '@/types';
import { v4 as uuidv4 } from 'uuid';

function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number = 15000, errorMsg: string = 'Operation timed out'): Promise<T> {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(errorMsg)), timeoutMs)
        )
    ]);
}

const generateId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : uuidv4());

export const sessionService = {
    async getSessions(programId: string) {
        const { data, error } = await withTimeout(
            supabase
                .from('sessions')
                .select('*')
                .eq('program_id', programId)
                .order('session_date', { ascending: true }),
            15000,
            'Failed to fetch sessions: request timed out.'
        );

        if (error) throw error;
        return data as Session[];
    },

    async updateSession(sessionId: string, updates: Partial<Session>) {
        const { data, error } = await withTimeout(
            supabase
                .from('sessions')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', sessionId)
                .select()
                .single(),
            15000,
            'Failed to update session: database request timed out.'
        );

        if (error) throw error;
        return data as Session;
    },

    async deleteSession(sessionId: string) {
        // Guard: Check if attendance records exist
        const { count, error: countError } = await withTimeout(
            supabase
                .from('attendance_records')
                .select('*', { count: 'exact', head: true })
                .eq('session_id', sessionId),
            15000,
            'Failed to verify attendance records: request timed out.'
        );

        if (countError) throw countError;
        if (count && count > 0) {
            throw new Error('HAS_ATTENDEES');
        }

        const { error } = await withTimeout(
            supabase
                .from('sessions')
                .delete()
                .eq('id', sessionId),
            15000,
            'Failed to delete session: database request timed out.'
        );

        if (error) throw error;
    },

    async createSession(session: Partial<Session>) {
        const id = session.id || generateId();
        const qr_code_data = session.qr_code_data || `sess-${id}`;

        const payload = {
            ...session,
            id,
            qr_code_data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data, error } = await withTimeout(
            supabase
                .from('sessions')
                .insert([payload])
                .select()
                .single(),
            15000,
            'Failed to publish session: database request timed out after 15 seconds. Please check your network connection.'
        );

        if (error) {
            console.error('Error in createSession:', error);
            throw error;
        }

        return data as Session;
    },

    async markAttendance(sessionId: string, userId: string, organizationId: string) {
        // 1. Check for Session Payment (only if session is configured as paid and fee > 0)
        const { data: session, error: sessError } = await supabase
            .from('sessions')
            .select('is_paid, session_fee')
            .eq('id', sessionId)
            .single();

        if (sessError) {
            console.error('Error fetching session in markAttendance:', sessError);
            throw sessError;
        }

        const isPaidSession = session?.is_paid === true && (Number(session?.session_fee) || 0) > 0;

        if (isPaidSession) {
            const sessEnroll = await this.getSessionPaymentStatus(sessionId, userId);
            if (!sessEnroll || sessEnroll.payment_status !== 'paid') {
                throw new Error('PAYMENT_REQUIRED');
            }
        }

        // 2. Check if attendance already exists
        const { data: existing } = await supabase
            .from('attendance_records')
            .select('*')
            .eq('session_id', sessionId)
            .eq('user_id', userId)
            .single();

        if (existing) {
            // Toggle Logic: If checked in but not checked out, clock them out
            if (existing.checked_in && !existing.exit_time) {
                const { data, error } = await supabase
                    .from('attendance_records')
                    .update({
                        exit_time: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();

                if (error) throw error;
                return { ...data, action: 'clock_out' };
            }

            // If already fully attended, just return or could reset (let's just return for now)
            return { ...existing, action: 'none' };
        }

        const { data, error } = await supabase
            .from('attendance_records')
            .insert([{
                session_id: sessionId,
                user_id: userId,
                organization_id: organizationId,
                checked_in: true,
                checked_in_at: new Date().toISOString(),
                entry_time: new Date().toISOString(),
                status: 'present',
                is_verified: false // Initially not verified if self-checked in
            }])
            .select()
            .single();

        if (error) throw error;
        return { ...data, action: 'clock_in' };
    },

    async processQRCheckin(qrData: string, userId: string, organizationId: string) {
        // 1. Identify if it's a Session QR or User QR
        // If participant scans Session QR:
        if (qrData.startsWith('sess-')) {
            const { data: session, error: sessError } = await supabase
                .from('sessions')
                .select('id, program_id')
                .eq('qr_code_data', qrData)
                .single();

            if (sessError || !session) throw new Error('Invalid Session QR');

            // Mark attendance
            return this.markAttendance(session.id, userId, organizationId);
        }

        // If admin scans Participant QR:
        if (qrData.startsWith('user-')) {
            // Here qrData is likely the enrollment or user ID encoded
            // For simplicity, let's assume it's the user ID for now
            const participantId = qrData.replace('user-', '');
            // We need a sessionId context here, usually passed from the scanning terminal
            // This would be handled in the UI calling this service
        }

        throw new Error('Unsupported QR format');
    },

    async getAttendanceForSession(sessionId: string) {
        const { data, error } = await supabase
            .from('attendance_records')
            .select(`
                *,
                users (
                    first_name,
                    surname,
                    profile_photo_url
                )
            `)
            .eq('session_id', sessionId);

        if (error) throw error;
        return data;
    },

    async getSessionPaymentStatus(sessionId: string, userId: string) {
        // Refined join based on schema: session_enrollments links to enrollments(id) as enrollment_id
        const { data: sessEnroll, error: enrollError } = await supabase
            .from('session_enrollments')
            .select(`
                *,
                enrollments!inner (user_id)
            `)
            .eq('session_id', sessionId)
            .eq('enrollments.user_id', userId)
            .single();

        if (enrollError && enrollError.code !== 'PGRST116') throw enrollError;
        return sessEnroll;
    },

    async getSessionsPaymentStatuses(sessionIds: string[], userId: string) {
        if (!sessionIds.length) return [];
        const { data, error } = await supabase
            .from('session_enrollments')
            .select(`
                *,
                enrollments!inner (user_id)
            `)
            .in('session_id', sessionIds)
            .eq('enrollments.user_id', userId);

        if (error) {
            console.error('Error fetching batch session payments:', error);
            return [];
        }
        return data || [];
    },

    async recordSessionPayment(
        sessionId: string,
        userId: string,
        organizationId: string,
        amount: number,
        method: string,
        processedById: string,
        paymentStatus: 'paid' | 'pending' = 'paid',
        receiptNumber?: string
    ) {
        // 1. Get enrollment ID
        const { data: enrollment } = await supabase
            .from('enrollments')
            .select('id')
            .eq('user_id', userId)
            .eq('organization_id', organizationId)
            .single();

        if (!enrollment) throw new Error('User not enrolled in program');

        // 2. Upsert session enrollment
        const { data: sessEnroll, error: sessErr } = await supabase
            .from('session_enrollments')
            .upsert([{
                organization_id: organizationId,
                enrollment_id: enrollment.id,
                session_id: sessionId,
                payment_status: paymentStatus,
                amount_paid: paymentStatus === 'paid' ? amount : 0,
                amount_due: amount
            }], { onConflict: 'enrollment_id, session_id' })
            .select()
            .single();

        if (sessErr) throw sessErr;

        // 3. Record in payment_records table for receipt
        const { data: payment, error: payErr } = await supabase
            .from('payment_records')
            .upsert([{
                organization_id: organizationId,
                user_id: userId,
                enrollment_id: enrollment.id,
                session_id: sessionId,
                amount: amount,
                status: 'paid',
                confirmed_by: processedById,
                confirmed_at: new Date().toISOString(),
                receipt_number: receiptNumber?.trim() || `SES-${Date.now().toString().slice(-6)}`
            }], { onConflict: 'session_id, user_id' })
            .select(`
                *,
                user:user_id(first_name, surname),
                program:program_id(name)
            `)
            .single();

        if (payErr) throw payErr;
        return payment;
    },

    async verifyAttendance(attendanceId: string, verifiedById: string) {
        const { data, error } = await supabase
            .from('attendance_records')
            .update({
                is_verified: true,
                verified_by: verifiedById,
                verified_at: new Date().toISOString()
            })
            .eq('id', attendanceId)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async bulkVerifyAttendance(sessionId: string, verifiedById: string) {
        const { data, error } = await supabase
            .from('attendance_records')
            .update({
                is_verified: true,
                verified_by: verifiedById,
                verified_at: new Date().toISOString()
            })
            .eq('session_id', sessionId)
            .eq('is_verified', false);

        if (error) throw error;
        return data;
    }
};

