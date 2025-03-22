import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Sidebar.css';

export default function Sidebar() {
  const { currentUser, signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();

  // Close sidebar when changing routes on mobile
  useEffect(() => {
    if (window.innerWidth <= 992) {
      setExpanded(false);
    }
  }, [location.pathname]);

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (expanded && window.innerWidth <= 992) {
        // Check if click was outside the sidebar
        const sidebar = document.querySelector('.sidebar');
        const toggleButton = document.querySelector('.mobile-toggle');
        
        if (sidebar && !sidebar.contains(event.target as Node) && 
            toggleButton && !toggleButton.contains(event.target as Node)) {
          setExpanded(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [expanded]);

  const toggleSidebar = () => {
    setExpanded(!expanded);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  return (
    <>
      {/* Mobile toggle button */}
      <button className="mobile-toggle" onClick={toggleSidebar} aria-label="Toggle menu">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {expanded ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </>
          ) : (
            <>
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </>
          )}
        </svg>
      </button>
      
      {/* Overlay for mobile */}
      <div 
        className={`sidebar-overlay ${expanded ? 'active' : ''}`} 
        onClick={() => setExpanded(false)}
      />
      
      <aside className={`sidebar ${expanded ? 'expanded' : ''}`}>
        <div className="sidebar-header">
          <h2>Trading Game</h2>
          <button className="sidebar-close" onClick={toggleSidebar} aria-label="Close menu">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <nav className="sidebar-nav">
          <ul>
            <li>
              <Link to="/trading" className={`nav-link ${location.pathname === '/trading' ? 'active' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"></line>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
                <span>Trading</span>
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                <span>Dashboard</span>
              </Link>
            </li>
            <li>
              <Link to="/account" className={`nav-link ${location.pathname === '/account' ? 'active' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Account</span>
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="sidebar-footer">
          {currentUser && (
            <div className="user-info">
              <div className="user-avatar">
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="User avatar" />
                ) : (
                  <div className="avatar-placeholder">
                    {(currentUser.displayName || currentUser.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="user-details">
                <p className="user-name">{currentUser.displayName || currentUser.email}</p>
              </div>
            </div>
          )}
          <button onClick={handleSignOut} className="logout-button">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
} 