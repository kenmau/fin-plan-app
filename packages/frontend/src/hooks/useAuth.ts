import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, UserResponse } from '@finplan/shared';
import { api, ApiRequestError } from '../lib/api';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

async function fetchMe(): Promise<UserResponse | null> {
  try {
    return await api.get<UserResponse>('/auth/me');
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 401) return null;
    throw err;
  }
}

/** Returns the current user, null if unauthenticated, or undefined while loading. */
export function useAuth() {
  return useQuery<UserResponse | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchMe,
    retry: false,
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => api.post<UserResponse>('/auth/login', body),
    onSuccess: (user) => {
      queryClient.setQueryData(AUTH_QUERY_KEY, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<void>('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(AUTH_QUERY_KEY, null);
      queryClient.clear();
    },
  });
}
