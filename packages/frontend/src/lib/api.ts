import type { ApiError, LoginRequest, UserResponse } from '@finplan/shared';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ error: { code: 'INTERNAL_ERROR', message: 'Request failed' } }));
    throw body as ApiError;
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    me: (): Promise<UserResponse> => request('/auth/me'),
    login: (data: LoginRequest): Promise<UserResponse> =>
      request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    logout: (): Promise<void> => request('/auth/logout', { method: 'POST' }),
  },
};
