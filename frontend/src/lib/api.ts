const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

export const apiFetch = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const url = `${API_URL}${path}`;
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  // Prepare Headers
  const headers = new Headers(options.headers || {});
  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const reqOptions: RequestInit = {
    ...options,
    headers,
  };

  try {
    let response = await fetch(url, reqOptions);

    // If Access Token is expired, try to refresh
    if (response.status === 401) {
      const data = await response.clone().json().catch(() => ({}));
      if (data?.error?.code === 'TOKEN_EXPIRED') {
        if (typeof window !== 'undefined') {
          const refreshToken = localStorage.getItem('refreshToken');
          if (!refreshToken) {
            // No refresh token, trigger logout redirect
            logoutRedirect();
            return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } };
          }

          if (!isRefreshing) {
            isRefreshing = true;
            try {
              const refreshResponse = await fetch(`${API_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken }),
              });

              const refreshResult = await refreshResponse.json();
              if (refreshResult.success && refreshResult.data) {
                const { accessToken: newAccess, refreshToken: newRefresh } = refreshResult.data;
                localStorage.setItem('accessToken', newAccess);
                localStorage.setItem('refreshToken', newRefresh);
                isRefreshing = false;
                onRefreshed(newAccess);
              } else {
                isRefreshing = false;
                logoutRedirect();
                return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } };
              }
            } catch (err) {
              isRefreshing = false;
              logoutRedirect();
              return { success: false, error: { code: 'UNAUTHORIZED', message: 'Session expired' } };
            }
          }

          // Queue requests while refreshing
          const retryRequest = new Promise<ApiResponse<T>>((resolve) => {
            subscribeTokenRefresh((newToken) => {
              headers.set('Authorization', `Bearer ${newToken}`);
              resolve(fetch(url, reqOptions).then((r) => r.json()));
            });
          });

          return retryRequest;
        }
      }
    }

    const result = await response.json();
    return result as ApiResponse<T>;
  } catch (error: any) {
    console.error(`API Request to ${path} failed:`, error);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network request failed',
      },
    };
  }
};

const logoutRedirect = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
};

export const api = {
  get: <T = any>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, { method: 'GET', ...options }),
  
  post: <T = any>(path: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  
  put: <T = any>(path: string, body?: any, options?: RequestInit) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...options,
    }),
  
  delete: <T = any>(path: string, options?: RequestInit) =>
    apiFetch<T>(path, { method: 'DELETE', ...options }),
};
