import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export function useAuth() {
  const { data: user, isLoading } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: api.auth.me,
    retry: false,
    staleTime: Infinity,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}

export function useInvalidateAuth() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY });
}
