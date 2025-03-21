import AuthComponent from '../components/AuthComponent';
import '../styles/Auth.css';

export default function Login() {
  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1>Trading Game</h1>
          <p>Sign in to start trading or create a new account</p>
        </div>
        <AuthComponent />
      </div>
    </div>
  );
} 