/**
 * Portal API helper & authentication
 */
const PORTAL_API = {
  BASE: '/api/portal',
  SERVER: 'http://localhost:3000',

  getToken() { return localStorage.getItem('portal_token'); },
  setToken(token) { localStorage.setItem('portal_token', token); },
  removeToken() { localStorage.removeItem('portal_token'); },

  getInvestor() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.removeToken();
        return null;
      }
      return payload;
    } catch { return null; }
  },

  async request(method, path, body) {
    const url = this.SERVER + this.BASE + path;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const token = this.getToken();
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '\u05E9\u05D2\u05D9\u05D0\u05D4');
    return data;
  },

  get(path) { return this.request('GET', path); },
  post(path, body) { return this.request('POST', path, body); },
  put(path, body) { return this.request('PUT', path, body); },

  async login(username, password) {
    const data = await this.post('/login', { username, password });
    this.setToken(data.token);
    return data;
  },

  logout() {
    this.removeToken();
    window.location.href = '/login.html';
  }
};

// Auth guard — call on every page except login
function requirePortalAuth() {
  const investor = PORTAL_API.getInvestor();
  if (!investor) {
    window.location.href = '/login.html';
    return false;
  }
  return investor;
}
