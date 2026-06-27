import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Pages
import RolePicker from './pages/RolePicker';
import AdminLogin from './pages/AdminLogin';
import EmpLogin from './pages/EmpLogin';
import AdminShell from './pages/admin/AdminShell';
import EmpShell from './pages/employee/EmpShell';

function App() {
  const { init, loading, isAdmin, employee } = useAuthStore();

  useEffect(() => { init(); }, [init]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ color: 'var(--accent)', fontWeight: 600 }}>กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RolePicker />} />
        <Route path="/admin/login" element={
          isAdmin ? <Navigate to="/admin" replace /> : <AdminLogin />
        } />
        <Route path="/emp/login" element={
          employee ? <Navigate to="/emp" replace /> : <EmpLogin />
        } />
        <Route path="/admin/*" element={
          isAdmin ? <AdminShell /> : <Navigate to="/admin/login" replace />
        } />
        <Route path="/emp/*" element={
          employee ? <EmpShell /> : <Navigate to="/emp/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
