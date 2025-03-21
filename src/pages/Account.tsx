import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import '../styles/Account.css';

export default function Account() {
  const { currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Here you would update the user profile in Firebase
    // For example: updateProfile(currentUser, { displayName })
    setIsEditing(false);
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <h1>Your Account</h1>
        <p>View and manage your profile</p>
      </div>

      <div className="account-content">
        <div className="profile-card">
          <div className="profile-header">
            <h2>Profile Information</h2>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="edit-button"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="form-input"
                />
              </div>
              <button type="submit" className="save-button">Save Changes</button>
            </form>
          ) : (
            <div className="profile-details">
              <div className="profile-avatar">
                {currentUser?.photoURL ? (
                  <img src={currentUser.photoURL} alt="Profile" />
                ) : (
                  <div className="avatar-placeholder">
                    {(currentUser?.displayName || currentUser?.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="profile-info">
                <div className="info-group">
                  <label>Display Name</label>
                  <p>{currentUser?.displayName || 'Not set'}</p>
                </div>
                <div className="info-group">
                  <label>Email</label>
                  <p>{currentUser?.email}</p>
                </div>
                <div className="info-group">
                  <label>Account Created</label>
                  <p>{currentUser?.metadata.creationTime ? new Date(currentUser.metadata.creationTime).toLocaleDateString() : 'Unknown'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="security-card">
          <h2>Security Settings</h2>
          <div className="security-option">
            <div>
              <h3>Password</h3>
              <p>Change your password</p>
            </div>
            <button className="secondary-button">Change Password</button>
          </div>
          <div className="security-option">
            <div>
              <h3>Two-Factor Authentication</h3>
              <p>Add an extra layer of security</p>
            </div>
            <button className="secondary-button">Enable</button>
          </div>
        </div>
      </div>
    </div>
  );
} 