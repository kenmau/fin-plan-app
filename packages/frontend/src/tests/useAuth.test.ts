import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock TanStack Query so we can control what useQuery returns
// ---------------------------------------------------------------------------
const mockUseQuery = vi.fn();
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (...args: Parameters<typeof actual.useQuery>) => mockUseQuery(...args),
  };
});

// Import AFTER mocks are set up
const { useAuth, AUTH_QUERY_KEY } = await import('../hooks/useAuth');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query configuration', () => {
    it('calls useQuery with correct queryKey', () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
      useAuth();
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: AUTH_QUERY_KEY }),
      );
    });

    it('calls useQuery with retry: false', () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
      useAuth();
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({ retry: false }),
      );
    });

    it('calls useQuery with staleTime: Infinity', () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
      useAuth();
      expect(mockUseQuery).toHaveBeenCalledWith(
        expect.objectContaining({ staleTime: Infinity }),
      );
    });
  });

  describe('return values', () => {
    it('returns isAuthenticated: false when user is undefined', () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
      const result = useAuth();
      expect(result.isAuthenticated).toBe(false);
      expect(result.user).toBeUndefined();
    });

    it('returns isAuthenticated: true when user is defined', () => {
      const user = { id: '1', username: 'ken', displayName: 'Ken' };
      mockUseQuery.mockReturnValue({ data: user, isLoading: false });
      const result = useAuth();
      expect(result.isAuthenticated).toBe(true);
      expect(result.user).toEqual(user);
    });

    it('returns isLoading: true while query is loading', () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
      const result = useAuth();
      expect(result.isLoading).toBe(true);
    });

    it('returns isLoading: false when query has settled', () => {
      mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });
      const result = useAuth();
      expect(result.isLoading).toBe(false);
    });
  });

  describe('AUTH_QUERY_KEY', () => {
    it('is a stable tuple starting with "auth"', () => {
      expect(AUTH_QUERY_KEY[0]).toBe('auth');
      expect(Array.isArray(AUTH_QUERY_KEY)).toBe(true);
    });
  });
});
