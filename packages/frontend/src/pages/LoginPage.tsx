import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiError } from '@finplan/shared';
import { api } from '../lib/api';
import { AUTH_QUERY_KEY, useAuth } from '../hooks/useAuth';

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const from = (location.state as { from?: Location })?.from?.pathname ?? '/';

  const loginMutation = useMutation({
    mutationFn: api.auth.login,
    onSuccess: async (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
      navigate(from, { replace: true });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username: username.trim(), password });
  };

  const errorMessage =
    loginMutation.error != null
      ? ((loginMutation.error as unknown as ApiError).error?.message ?? 'Invalid username or password')
      : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm">
        {/* Logo / App name */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">FinPlan</h1>
          <p className="mt-1 text-sm text-slate-500">Household Financial Planner</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 px-8 py-8">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Sign in</h2>

          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* Username */}
              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  placeholder="Enter your username"
                  disabled={loginMutation.isPending}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
                  placeholder="Enter your password"
                  disabled={loginMutation.isPending}
                />
              </div>

              {/* Error message */}
              {errorMessage && (
                <p role="alert" className="text-sm text-red-600">
                  {errorMessage}
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loginMutation.isPending || !username || !password}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {loginMutation.isPending ? 'Signing in…' : 'Sign In'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
