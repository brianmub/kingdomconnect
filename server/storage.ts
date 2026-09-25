import { supabase } from './lib/supabase';

export interface User {
  id: string;
  title?: string;
  full_name: string; // Combined from first_name and surname
  first_name?: string;
  surname?: string;
  phone: string;
  email: string;
  password_hash?: string;
  gender: 'male' | 'female';
  marital_status: 'married' | 'unmarried' | 'widowed' | 'divorced';
  role: string; // Flexible role
  leader_status?: 'pending' | 'approved' | 'rejected';
  cell_id?: string;
  is_active: boolean;
  is_onboarding_complete?: boolean;
  organization_id?: string;
  dob?: string;
  church_name?: string;
  residential_address?: string;
  suburb?: string;
  city_town?: string;
  province?: string;
  country?: string;
  created_at: string;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  enrollment_start_date: string;
  enrollment_end_date: string;
  program_start_date: string;
  is_active: boolean;
  min_cell_size: number;
  max_cell_size: number;
}

export interface Session {
  id: string;
  program_id: string;
  session_number: number;
  date: string;
  title: string;
  overview: string;
  topics: string[];
  assignment_id?: string;
  qr_code_data: string;
}

export interface Enrollment {
  id: string;
  program_id: string;
  organization_id: string;
  user_id: string;
  status: 'enrolled' | 'assigned' | 'graduated' | 'incomplete';
  cell_id?: string;
  enrolled_at: string;
  sessions_attended: number;
  assignments_completed: number;
  payment_status?: string;
}

export interface CellGroup {
  id: string;
  program_id: string;
  name: string;
  leader_id: string;
}

export interface Assignment {
  id: string;
  organization_id: string;
  session_id: string;
  program_id: string;
  title: string;
  description: string;
  due_date: string;
  submission_type: 'text' | 'file';
}

export interface FileAttachment {
  id: string;
  submission_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string;
  submitted_at: string;
  is_late: boolean;
  is_confirmed: boolean;
  attachments?: FileAttachment[];
}

export interface AttendanceRecord {
  id: string;
  organization_id: string;
  session_id: string;
  program_id: string;
  user_id: string;
  checked_in: boolean;
  checked_in_at?: string;
  entry_time?: string;
  exit_time?: string;
  is_verified: boolean;
  confirmed_by_leader: boolean;
  confirmed_at?: string;
}

export type PaymentStatus = "pending" | "paid" | "waived" | "unpaid";

export interface PaymentRecord {
  id: string;
  session_id: string;
  program_id: string;
  user_id: string;
  amount?: number;
  status: PaymentStatus;
  receipt_number?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  unpaid_reason?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  performed_by: string;
  target_user_id?: string;
  target_cell_id?: string;
  program_id?: string;
  session_id?: string;
  details: string;
  timestamp: string;
}

export const storage = {
  // Organizations
  async getOrganizationByJoinCode(code: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('join_code', code.toUpperCase())
      .single();

    if (error) {
       console.error('Error fetching organization by join code:', error);
       return null;
    }
    return data;
  },

  // Users
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    return (data || []).map(u => ({
      ...u,
      full_name: `${u.first_name || ''} ${u.surname || ''}`.trim()
    }));
  },

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error) return null;
    return {
      ...data,
      full_name: `${data.first_name || ''} ${data.surname || ''}`.trim()
    };
  },

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await supabase.from('users').select('*').eq('email', email).single();
    if (error) return null;
    return {
      ...data,
      full_name: `${data.first_name || ''} ${data.surname || ''}`.trim()
    };
  },

  async createUser(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const { full_name, role, ...rest } = user;
    const nameParts = full_name.trim().split(/\s+/);
    const first_name = nameParts[0] || '';
    const surname = nameParts.slice(1).join(' ') || 'User';

    const { data, error } = await supabase.from('users').insert({
      first_name,
      surname,
      role,
      ...rest,
      is_active: true // Default to active in the existing system
    }).select().single();
    if (error) throw error;
    return {
      ...data,
      full_name: `${data.first_name || ''} ${data.surname || ''}`.trim()
    };
  },

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    let finalUpdates = { ...updates } as any;
    if (updates.full_name) {
      const nameParts = updates.full_name.trim().split(/\s+/);
      finalUpdates.first_name = nameParts[0];
      finalUpdates.surname = nameParts.slice(1).join(' ');
      delete finalUpdates.full_name;
    }

    const { data, error } = await supabase.from('users').update(finalUpdates).eq('id', id).select().single();
    if (error) throw error;
    return {
      ...data,
      full_name: `${data.first_name || ''} ${data.surname || ''}`.trim()
    };
  },

  async deleteUser(id: string): Promise<void> {
    try {
      // 1. Get all submissions by this user to find related file attachments
      const { data: submissions } = await supabase.from('assignment_submissions').select('id').eq('user_id', id);
      
      if (submissions && submissions.length > 0) {
        const submissionIds = submissions.map(s => s.id);
        
        // 2. Get all attachments for these submissions
        const { data: attachments } = await supabase.from('file_attachments').select('file_url').in('submission_id', submissionIds);
        
        if (attachments && attachments.length > 0) {
          const fs = await import('node:fs');
          const path = await import('node:path');
          const uploadsDir = path.join(process.cwd(), "uploads");

          for (const attachment of attachments) {
            try {
              // Extract filename from URL (assuming format: http://.../uploads/filename)
              const filename = attachment.file_url.split('/').pop();
              if (filename) {
                const filePath = path.join(uploadsDir, filename);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                }
              }
            } catch (fileErr) {
              console.error('Error deleting file:', fileErr);
            }
          }
        }
        
        // 3. Delete attachments from DB
        await supabase.from('file_attachments').delete().in('submission_id', submissionIds);
      }

      // 4. Delete related data to ensure clean removal
      await supabase.from('attendance_records').delete().eq('user_id', id);
      await supabase.from('payment_records').delete().eq('user_id', id);
      await supabase.from('assignment_submissions').delete().eq('user_id', id);
      await supabase.from('enrollments').delete().eq('user_id', id);
      await supabase.from('cell_members').delete().eq('user_id', id);
      
      // Also handle audit logs where user is the target
      await supabase.from('audit_logs').delete().eq('target_user_id', id);
      
      // Finally delete the user
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('Error in deleteUser:', err);
      throw err;
    }
  },

  async getPendingLeaders(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*').eq('role', 'leader').eq('leader_status', 'pending');
    if (error) throw error;
    return data || [];
  },

  async getApprovedLeaders(): Promise<User[]> {
    const { data, error } = await supabase.from('users').select('*').eq('role', 'leader').eq('leader_status', 'approved');
    if (error) throw error;
    return data || [];
  },

  // Programs
  async getPrograms(organizationId?: string): Promise<Program[]> {
    let query = supabase.from('programs').select('*').eq('is_active', true);
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    // Sort by name for better UX
    query = query.order('name', { ascending: true });
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getProgramById(id: string): Promise<Program | null> {
    const { data, error } = await supabase.from('programs').select('*').eq('id', id).single();
    if (error) return null;
    return data;
  },

  async createProgram(program: Omit<Program, 'id'>): Promise<Program> {
    const { data, error } = await supabase.from('programs').insert(program).select().single();
    if (error) throw error;
    return data;
  },

  async updateProgram(id: string, updates: Partial<Program>): Promise<Program | null> {
    const { data, error } = await supabase.from('programs').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Sessions
  async getSessions(organizationId?: string): Promise<Session[]> {
    let query = supabase.from('sessions').select('*').order('session_number');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(this.mapDbSessionToMobile);
  },

  async getSessionsByProgram(programId: string): Promise<Session[]> {
    const { data, error } = await supabase.from('sessions').select('*').eq('program_id', programId).order('session_number');
    if (error) throw error;
    return (data || []).map(this.mapDbSessionToMobile);
  },

  async getSessionById(id: string): Promise<Session | null> {
    const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
    if (error || !data) return null;
    return this.mapDbSessionToMobile(data);
  },

  mapDbSessionToMobile(row: any): Session {
    return {
      id: row.id,
      program_id: row.program_id,
      session_number: row.session_number || 1,
      date: row.session_date || new Date().toISOString(),
      title: row.name || 'Unnamed Session',
      overview: row.description || '',
      topics: [],
      qr_code_data: row.qr_code_data || '',
    };
  },

  async updateSession(id: string, updates: Partial<Session> & { name?: string; description?: string; session_date?: string; start_time?: string; end_time?: string }): Promise<Session | null> {
    const payload: any = {
      updated_at: new Date().toISOString()
    };
    if (updates.title !== undefined || updates.name !== undefined) {
      const val = updates.title || updates.name;
      payload.name = val;
      payload.title = val;
    }
    if (updates.overview !== undefined || updates.description !== undefined) {
      const val = updates.overview ?? updates.description;
      payload.description = val;
      payload.overview = val;
    }
    if (updates.date !== undefined || updates.session_date !== undefined) {
      const val = updates.date || updates.session_date;
      payload.session_date = val ? val.split('T')[0] : null;
      payload.date = val ? (val.includes('T') ? val : `${val}T00:00:00.000Z`) : null;
    }
    if (updates.session_number !== undefined) {
      payload.session_number = updates.session_number;
    }
    if (updates.start_time !== undefined) {
      payload.start_time = updates.start_time;
    }
    if (updates.end_time !== undefined) {
      payload.end_time = updates.end_time;
    }

    const { data, error } = await supabase.from('sessions').update(payload).eq('id', id).select().single();
    if (error) throw error;
    return this.mapDbSessionToMobile(data);
  },

  async createSession(session: Omit<Session, 'id' | 'qr_code_data'> & { qr_code_data?: string; organization_id?: string; name?: string; description?: string; session_date?: string; start_time?: string; end_time?: string }): Promise<Session> {
    let orgId = (session as any).organization_id;
    if (!orgId && session.program_id) {
      const { data: prog } = await supabase.from('programs').select('organization_id').eq('id', session.program_id).single();
      if (prog) orgId = prog.organization_id;
    }

    const sessionName = session.title || session.name || 'New Session';
    const sessionDesc = session.overview || session.description || '';
    const sessionDate = session.date || session.session_date || new Date().toISOString().split('T')[0];
    const normalizedDate = sessionDate.includes('T') ? sessionDate.split('T')[0] : sessionDate;

    const { data, error } = await supabase.from('sessions').insert({
       organization_id: orgId,
       program_id: session.program_id,
       name: sessionName,
       title: sessionName,
       description: sessionDesc,
       overview: sessionDesc,
       session_date: normalizedDate,
       date: `${normalizedDate}T00:00:00.000Z`,
       start_time: session.start_time || '09:00:00',
       end_time: session.end_time || '11:00:00',
       session_number: session.session_number || 1,
       qr_code_data: session.qr_code_data || `session-${Math.random().toString(36).substring(2, 11)}`
    }).select().single();
    if (error) throw error;
    return this.mapDbSessionToMobile(data);
  },

  async deleteSession(id: string): Promise<void> {
    const { error } = await supabase.from('sessions').delete().eq('id', id);
    if (error) throw error;
  },

  // Enrollments
  async getEnrollments(organizationId?: string): Promise<Enrollment[]> {
    let query = supabase.from('enrollments').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getUserEnrollments(userId: string): Promise<Enrollment[]> {
    const { data, error } = await supabase.from('enrollments').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async getUserEnrollment(userId: string, programId: string): Promise<Enrollment | null> {
    const { data, error } = await supabase.from('enrollments').select('*').eq('user_id', userId).eq('program_id', programId).single();
    if (error) return null;
    return data;
  },

  async createEnrollment(enrollment: Omit<Enrollment, 'id' | 'enrolled_at'>): Promise<Enrollment> {
    const { data, error } = await supabase.from('enrollments').insert(enrollment).select().single();
    if (error) throw error;
    return data;
  },

  async updateEnrollment(id: string, updates: Partial<Enrollment>): Promise<Enrollment | null> {
    const { data, error } = await supabase.from('enrollments').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Cell Groups
  async getCellGroups(): Promise<CellGroup[]> {
    const { data, error } = await supabase.from('cell_groups').select('*');
    if (error) throw error;
    return data || [];
  },

  async getCellGroupsByProgram(programId: string): Promise<CellGroup[]> {
    const { data, error } = await supabase.from('cell_groups').select('*').eq('program_id', programId);
    if (error) throw error;
    return data || [];
  },

  async createCellGroup(cell: Omit<CellGroup, 'id'>): Promise<CellGroup> {
    const { data, error } = await supabase.from('cell_groups').insert(cell).select().single();
    if (error) throw error;
    return data;
  },

  async getCellMembers(cellId: string): Promise<{ user_id: string }[]> {
    const { data, error } = await supabase.from('cell_members').select('user_id').eq('cell_id', cellId);
    if (error) throw error;
    return data || [];
  },

  async addCellMember(cellId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('cell_members').insert({ cell_id: cellId, user_id: userId });
    if (error) throw error;
  },

  async removeCellMember(cellId: string, userId: string): Promise<void> {
    const { error } = await supabase.from('cell_members').delete().eq('cell_id', cellId).eq('user_id', userId);
    if (error) throw error;
  },

  async updateEnrollmentCell(userId: string, cellId: string): Promise<void> {
    const { error } = await supabase.from('enrollments').update({ cell_id: cellId, status: 'assigned' }).eq('user_id', userId);
    if (error) throw error;
  },

  async getUnassignedParticipants(programId: string): Promise<User[]> {
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('program_id', programId)
      .eq('status', 'enrolled')
      .is('cell_id', null);

    if (enrollError) throw enrollError;
    if (!enrollments || enrollments.length === 0) return [];

    const userIds = enrollments.map(e => e.user_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*')
      .in('id', userIds);

    if (usersError) throw usersError;

    return (users || []).map(u => ({
      ...u,
      full_name: `${u.first_name || ''} ${u.surname || ''}`.trim()
    }));
  },

  // Assignments
  async getAssignments(organizationId?: string): Promise<Assignment[]> {
    let query = supabase.from('assignments').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAssignmentsByProgram(programId: string): Promise<Assignment[]> {
    const { data, error } = await supabase.from('assignments').select('*').eq('program_id', programId);
    if (error) throw error;
    return data || [];
  },

  async createAssignment(assignment: Omit<Assignment, 'id'>): Promise<Assignment> {
    const { data, error } = await supabase.from('assignments').insert(assignment).select().single();
    if (error) throw error;
    return data;
  },

  // Assignment Submissions
  async getSubmissions(organizationId?: string): Promise<AssignmentSubmission[]> {
    let query = supabase.from('assignment_submissions').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getUserSubmissions(userId: string): Promise<AssignmentSubmission[]> {
    const { data, error } = await supabase.from('assignment_submissions').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async createSubmission(submission: Omit<AssignmentSubmission, 'id' | 'submitted_at'>): Promise<AssignmentSubmission> {
    const { data, error } = await supabase.from('assignment_submissions').insert(submission).select().single();
    if (error) throw error;
    return data;
  },

  async updateSubmission(id: string, updates: Partial<AssignmentSubmission>): Promise<AssignmentSubmission | null> {
    const { data, error } = await supabase.from('assignment_submissions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // File Attachments
  async getAttachmentsBySubmission(submissionId: string): Promise<FileAttachment[]> {
    const { data, error } = await supabase.from('file_attachments').select('*').eq('submission_id', submissionId);
    if (error) throw error;
    return data || [];
  },

  async createAttachment(attachment: Omit<FileAttachment, 'id' | 'uploaded_at'>): Promise<FileAttachment> {
    const { data, error } = await supabase.from('file_attachments').insert(attachment).select().single();
    if (error) throw error;
    return data;
  },

  async deleteAttachment(id: string): Promise<void> {
    const { error } = await supabase.from('file_attachments').delete().eq('id', id);
    if (error) throw error;
  },

  // Attendance
  async getAttendance(organizationId?: string): Promise<AttendanceRecord[]> {
    let query = supabase.from('attendance_records').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getUserAttendance(userId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase.from('attendance_records').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async getSessionAttendance(sessionId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabase.from('attendance_records').select('*').eq('session_id', sessionId);
    if (error) throw error;
    return data || [];
  },

  async upsertAttendance(record: Omit<AttendanceRecord, 'id'>): Promise<AttendanceRecord> {
    const { data, error } = await supabase
      .from('attendance_records')
      .upsert(record, { onConflict: 'session_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAttendance(id: string, updates: Partial<AttendanceRecord>): Promise<AttendanceRecord | null> {
    const { data, error } = await supabase.from('attendance_records').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // Payments
  async getPayments(organizationId?: string): Promise<PaymentRecord[]> {
    let query = supabase.from('payment_records').select('*');
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getUserPayments(userId: string): Promise<PaymentRecord[]> {
    const { data, error } = await supabase.from('payment_records').select('*').eq('user_id', userId);
    if (error) throw error;
    return data || [];
  },

  async createPayment(payment: Omit<PaymentRecord, 'id'>): Promise<PaymentRecord> {
    const { data, error } = await supabase.from('payment_records').insert(payment).select().single();
    if (error) throw error;
    return data;
  },

  async updatePayment(id: string, updates: Partial<PaymentRecord>): Promise<PaymentRecord | null> {
    const { data, error } = await supabase.from('payment_records').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  async getSessionPayments(sessionId: string): Promise<PaymentRecord[]> {
    const { data, error } = await supabase.from('payment_records').select('*').eq('session_id', sessionId);
    if (error) throw error;
    return data || [];
  },

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  },

  async createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<AuditLog> {
    const { data, error } = await supabase.from('audit_logs').insert(log).select().single();
    if (error) throw error;
    return data;
  },

  async autoAssignCells(programId: string, performedBy: string): Promise<{ cells: CellGroup[]; assignedCount: number }> {
    const program = await this.getProgramById(programId);
    if (!program) throw new Error('Program not found');

    const now = new Date();
    const enrollmentEnd = new Date(program.enrollment_end_date);
    if (now < enrollmentEnd) {
      throw new Error('Enrollment period has not ended yet');
    }

    const existingCells = await this.getCellGroupsByProgram(programId);
    if (existingCells.length > 0) {
      throw new Error('Cells already exist for this program');
    }

    const enrollments = await this.getEnrollments();
    const programEnrollments = enrollments.filter(e => e.program_id === programId && e.status === 'enrolled');

    if (programEnrollments.length === 0) {
      throw new Error('No enrolled participants found');
    }

    const users = await this.getAllUsers();
    const approvedLeaders = users.filter((u: User) => u.role === 'leader' && u.leader_status === 'approved');

    if (approvedLeaders.length === 0) {
      throw new Error('No approved leaders available');
    }

    const participants = programEnrollments
      .map(e => users.find((u: User) => u.id === e.user_id))
      .filter((u): u is User => u !== undefined);

    const married = participants.filter(p => p.marital_status === 'married');
    const unmarried = participants.filter(p => p.marital_status === 'unmarried');

    const minCellSize = program.min_cell_size || 5;
    const maxCellSize = program.max_cell_size || 12;

    const idealCellCount = Math.ceil(participants.length / maxCellSize);
    const numCells = Math.min(
      approvedLeaders.length,
      Math.max(idealCellCount, Math.ceil(participants.length / minCellSize))
    );

    if (numCells === 0) {
      throw new Error('Cannot create cells with current constraints');
    }

    const cells: CellGroup[] = [];
    const cellMemberLists: string[][] = Array.from({ length: numCells }, () => []);

    for (let i = 0; i < numCells; i++) {
      const cell = await this.createCellGroup({
        program_id: programId,
        name: `Cell ${i + 1}`,
        leader_id: approvedLeaders[i].id,
      });
      cells.push(cell);

      await this.createAuditLog({
        action: 'cell_created',
        performed_by: performedBy,
        target_cell_id: cell.id,
        program_id: programId,
        details: `Cell ${cell.name} created with leader ${approvedLeaders[i].full_name}`,
      });
    }

    const shuffleArray = <T>(arr: T[]): T[] => {
      const shuffled = [...arr];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const shuffledMarried = shuffleArray(married);
    const shuffledUnmarried = shuffleArray(unmarried);

    let cellIndex = 0;
    let marriedIdx = 0;
    let unmarriedIdx = 0;
    let useMarried = true;

    while (marriedIdx < shuffledMarried.length || unmarriedIdx < shuffledUnmarried.length) {
      let participant: User | null = null;

      if (useMarried && marriedIdx < shuffledMarried.length) {
        participant = shuffledMarried[marriedIdx++];
      } else if (!useMarried && unmarriedIdx < shuffledUnmarried.length) {
        participant = shuffledUnmarried[unmarriedIdx++];
      } else if (marriedIdx < shuffledMarried.length) {
        participant = shuffledMarried[marriedIdx++];
      } else if (unmarriedIdx < shuffledUnmarried.length) {
        participant = shuffledUnmarried[unmarriedIdx++];
      }

      if (participant) {
        cellMemberLists[cellIndex].push(participant.id);
        cellIndex = (cellIndex + 1) % numCells;
        useMarried = !useMarried;
      }
    }

    let assignedCount = 0;
    for (let i = 0; i < numCells; i++) {
      for (const userId of cellMemberLists[i]) {
        await this.addCellMember(cells[i].id, userId);

        const enrollment = programEnrollments.find(e => e.user_id === userId);
        if (enrollment) {
          await this.updateEnrollment(enrollment.id, {
            status: 'assigned',
            cell_id: cells[i].id,
          });
        }
        assignedCount++;
      }
    }

    await this.createAuditLog({
      action: 'cells_auto_assigned',
      performed_by: performedBy,
      program_id: programId,
      details: `Auto-assigned ${assignedCount} participants to ${numCells} cells with balanced married/unmarried distribution`,
    });

    return { cells, assignedCount };
  },
};
