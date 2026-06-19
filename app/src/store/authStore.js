import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export const useAuthStore = create((set, get) => ({
  session: null,       // Supabase session (admin)
  employee: null,      // employee row (พนักงานที่ login ด้วย PIN)
  employeeSessionToken: localStorage.getItem('hr_employee_session_token') || null,
  isAdmin: false,
  orgId: null,
  loading: true,

  // ---- Admin login (email/password via Supabase Auth) ---------
  async adminLogin(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error.message || '';
      if (message.toLowerCase().includes('invalid login')) {
        throw new Error('อีเมลหรือรหัสผ่านแอดมินไม่ถูกต้อง');
      }
      throw error;
    }
    // ตรวจสอบว่า user นี้อยู่ใน admin_roles
    const { data: role, error: roleError } = await supabase
      .from('admin_roles')
      .select('org_id')
      .eq('auth_user_id', data.user.id)
      .maybeSingle();
    if (roleError) {
      await supabase.auth.signOut();
      throw new Error(`ตรวจสอบสิทธิ์แอดมินไม่สำเร็จ: ${roleError.message}`);
    }
    if (!role?.org_id) {
      await supabase.auth.signOut();
      throw new Error('บัญชีนี้ยังไม่มีสิทธิ์แอดมิน กรุณารัน SQL เพิ่ม admin_roles');
    }
    set({ session: data.session, isAdmin: true, orgId: role.org_id, employee: null, employeeSessionToken: null });
    localStorage.removeItem('hr_employee_session_token');
    return role.org_id;
  },

  async adminLogout() {
    await supabase.auth.signOut();
    set({ session: null, isAdmin: false, orgId: null, employee: null });
  },

  // ---- Employee PIN login (custom — no Supabase Auth session needed) ---
  // PIN ถูก hash ไว้ใน employees.pin_hash และตรวจผ่าน RPC ที่คืน session token
  async empLoginByPin(empOrId, pin) {
    const empId = typeof empOrId === 'object' ? empOrId.id : empOrId;
    const { data, error } = await supabase.rpc('employee_pin_login_session', {
      p_emp_id: empId,
      p_pin: pin,
    });
    if (error) {
      const message = error.message || '';
      if (message.includes('ล็อก') || message.toLowerCase().includes('locked')) {
        throw new Error('PIN ถูกล็อกชั่วคราว กรุณารอ 10 นาที หรือให้แอดมินปลดล็อก');
      }
      throw new Error(`PIN ไม่ถูกต้อง (${message})`);
    }
    const emp = data?.employee;
    const token = data?.session_token;
    if (!emp || !token) throw new Error('PIN ไม่ถูกต้อง');

    localStorage.setItem('hr_employee_session_token', token);
    set({ session: null, employee: emp, employeeSessionToken: token, isAdmin: false, orgId: emp.org_id });
    return emp;
  },

  async empLogout() {
    const token = get().employeeSessionToken;
    if (token) await supabase.rpc('employee_logout_session', { p_session_token: token });
    localStorage.removeItem('hr_employee_session_token');
    set({ session: null, employee: null, employeeSessionToken: null, isAdmin: false, orgId: null });
  },

  // ---- Listen for Supabase session changes ---------------------
  async init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const uid = session.user.id;
      // check admin
      const { data: role } = await supabase
        .from('admin_roles')
        .select('org_id')
        .eq('auth_user_id', uid)
        .maybeSingle();
      if (role) {
        set({ session, isAdmin: true, orgId: role.org_id, loading: false });
        return;
      }
      // check employee
      const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', uid)
        .maybeSingle();
      if (emp) {
        set({ session, employee: emp, isAdmin: false, orgId: emp.org_id, loading: false });
        return;
      }
    }
    const employeeSessionToken = localStorage.getItem('hr_employee_session_token');
    if (employeeSessionToken) {
      const { data: emp } = await supabase.rpc('employee_current_session', {
        p_session_token: employeeSessionToken,
      });
      if (emp?.id) {
        set({ session: null, employee: emp, employeeSessionToken, isAdmin: false, orgId: emp.org_id, loading: false });
        return;
      }
      localStorage.removeItem('hr_employee_session_token');
    }
    set({ loading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) set({ session: null, employee: null, isAdmin: false, orgId: null });
    });
  },
}));
