import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Browse from './pages/Browse';
import AuctionDetail from './pages/AuctionDetail';
import Sell from './pages/Sell';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import GoogleCallback from './pages/GoogleCallback';
import './index.css';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/browse" replace />;
  return children;
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/auction/:id" element={<AuctionDetail />} />
        <Route path="/auth/google/callback" element={<GoogleCallback />} />

        {/* Protected */}
        <Route path="/sell" element={
          <ProtectedRoute roles={['seller', 'admin']}>
            <Sell />
          </ProtectedRoute>
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Footer />
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#F9F7F1',
                color: '#2C2C2C',
                border: '1px solid #2C2C2C',
                fontFamily: 'Playfair Display, serif',
                fontSize: '14px',
                borderRadius: '0px',
                padding: '12px 16px',
                boxShadow: '4px 4px 0px rgba(0,0,0,0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#2C2C2C',
                  secondary: '#F9F7F1',
                },
              },
              error: {
                style: {
                  background: '#F9F7F1',
                  color: '#2C2C2C',
                  border: '1px solid #2C2C2C',
                },
                iconTheme: {
                  primary: '#2C2C2C',
                  secondary: '#F9F7F1',
                },
              },
            }}
          />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
