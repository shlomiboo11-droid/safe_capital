/**
 * API Client — handles auth tokens and HTTP requests
 */
const API = {
  BASE: '/api',

  getToken() {
    return localStorage.getItem('sc_token');
  },

  setToken(token) {
    localStorage.setItem('sc_token', token);
  },

  getUser() {
    const raw = localStorage.getItem('sc_user');
    return raw ? JSON.parse(raw) : null;
  },

  setUser(user) {
    localStorage.setItem('sc_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    window.location.href = '/login';
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  /**
   * Make authenticated API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.BASE}${endpoint}`;
    const headers = {
      ...(options.headers || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData (browser handles it with boundary)
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      if (options.body && typeof options.body === 'object') {
        options.body = JSON.stringify(options.body);
      }
    }

    try {
      const resp = await fetch(url, { ...options, headers });

      if (resp.status === 401) {
        this.logout();
        return null;
      }

      // Check if response is JSON before parsing
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await resp.text();
        console.error(`API returned non-JSON (${resp.status}):`, text.substring(0, 200));
        if (resp.status === 413) throw new Error('הקבצים גדולים מדי. מקסימום 4.5MB בסה"כ');
        if (resp.status === 504) throw new Error('הבקשה נגמרה בזמן — נסה שוב');
        throw new Error(`שגיאת שרת (${resp.status})`);
      }

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // Convenience methods
  get(endpoint) { return this.request(endpoint); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },

  /**
   * Upload files
   */
  async upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type with boundary
    });
  }
};

/**
 * Auth guard — redirect to login if not authenticated
 */
function requireAuth() {
  if (!API.isLoggedIn()) {
    window.location.href = '/login';
    return false;
  }
  return true;
}

/**
 * Check if user has specific role
 */
function hasRole(...roles) {
  const user = API.getUser();
  return user && roles.includes(user.role);
}
