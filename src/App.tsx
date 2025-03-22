import { AuthProvider, useAuth } from './context/AuthContext'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Login from './pages/Login'
import Account from './pages/Account'
import Sidebar from './components/Sidebar'
import Trading from './pages/Trading'
import './styles/Layout.css'

// Dashboard component (placeholder)
const Dashboard = () => (
  <div className="dashboard-content">
    <h1>Dashboard</h1>
    <p>Welcome to the Trading Game dashboard. Start trading now!</p>
    <div className="dashboard-stats">
      <div className="stat-card">
        <h3>Balance</h3>
        <p className="stat-value">$10,000</p>
      </div>
      <div className="stat-card">
        <h3>Trades</h3>
        <p className="stat-value">0</p>
      </div>
      <div className="stat-card">
        <h3>Performance</h3>
        <p className="stat-value">0%</p>
      </div>
    </div>
  </div>
);

function AppContent() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/trading" element={<Trading />} />
          <Route path="/account" element={<Account />} />
          <Route path="/" element={<Navigate to="/trading" replace />} />
          <Route path="*" element={<Navigate to="/trading" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App
