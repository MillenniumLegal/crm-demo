import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

export const Login: React.FC = () => {
  const { login, isAuthenticated, isLoading } = useAuth();
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Check for inactive message from sessionStorage
  useEffect(() => {
    const inactiveMessage = sessionStorage.getItem('inactiveMessage');
    if (inactiveMessage) {
      setError(inactiveMessage);
      sessionStorage.removeItem('inactiveMessage');
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#011E41] via-[#011E40] to-[#9164CC]">
        <div className="animate-spin rounded-full h-24 w-24 border-b-2 border-[#F8F8F9]"></div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const result = await login(credentials);
    if (!result.success) {
      setError(result.error || 'Invalid email or password. Please try again.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({
      ...credentials,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-gradient-to-br from-[#011E41] via-[#011E40] to-[#9164CC] px-4 py-12">
      <div className="absolute inset-0 bg-[url('/millennium-legal-logo.svg')] opacity-[0.05] bg-center bg-[45rem] bg-no-repeat pointer-events-none" />
      <div className="relative w-full max-w-lg">
        <div className="absolute inset-0 blur-3xl opacity-40 bg-gradient-to-b from-[#9164CC] via-transparent to-[#011E40]" />
        <div className="relative w-full rounded-[2.5rem] border border-white/10 bg-white/10 backdrop-blur-xl shadow-[0_25px_80px_-20px_rgba(17,24,39,0.35)]">
          <div className="p-10 lg:p-16">
            <div className="flex items-center space-x-4 mb-12">
              <img
                src="/millennium-legal-logo.svg"
                alt="Millennium Legal Conveyancing Ltd"
                className="w-24 h-24 drop-shadow-[0_16px_32px_rgba(17,24,39,0.35)]"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-white/70">Millennium Legal Conveyancing Ltd</p>
                <h2 className="text-xl font-semibold text-white">Workspace</h2>
              </div>
            </div>

            <div className="space-y-1 mb-10">
              <h2 className="text-4xl font-semibold text-white">Welcome back</h2>
              <p className="text-sm text-white/70">Enter your credentials to continue.</p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-white/80">
                    Email address
                  </label>
                  <div className="mt-2 relative rounded-2xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-white/50" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="w-full pl-11 py-3 rounded-2xl bg-white/10 border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#9164CC] focus:border-transparent transition-shadow shadow-lg hover:shadow-xl backdrop-blur"
                      placeholder="name@millenniumlegal.co.uk"
                      value={credentials.email}
                      onChange={handleChange}
                    />
                  </div>
                </div>
                
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="block text-sm font-medium text-white/80">
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-xs font-medium text-[#F8F8F9] hover:text-white transition"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <div className="mt-2 relative rounded-2xl shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-white/50" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="w-full pl-11 pr-12 py-3 rounded-2xl bg-white/10 border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#9164CC] focus:border-transparent transition-shadow shadow-lg hover:shadow-xl backdrop-blur"
                      placeholder="Enter your password"
                      value={credentials.password}
                      onChange={handleChange}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/50 hover:text-white"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-400/30 text-[#F8F8F9] px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 flex items-center justify-center rounded-2xl bg-gradient-to-r from-[#011E41] via-[#9164CC] to-[#011E40] hover:from-[#9164CC] hover:to-[#011E41] text-white font-medium shadow-xl shadow-[#011E41]/25 transition-transform duration-200 hover:-translate-y-0.5"
              >
                Sign in
              </button>
            </form>

            <p className="mt-12 text-xs text-white/60 text-center tracking-wide">
              Millennium Legal Conveyancing Ltd © {new Date().getFullYear()} • Secure workspace
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
