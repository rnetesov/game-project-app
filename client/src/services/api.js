const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Произошла ошибка запроса');
  return data;
}

export function getServerHealth() {
  return request('/health');
}

export function registerUser(payload) {
  return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
}

export function loginUser(payload) {
  return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) });
}

export function getCurrentUser(token) {
  return request('/auth/me', { token });
}

export function getProfile(username) {
  return request(`/profiles/${encodeURIComponent(username)}`);
}

export function updateMyProfile(payload) {
  const token = localStorage.getItem('gamehub_access_token');
  return request('/profiles/me', {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  });
}

const authToken = () => localStorage.getItem('gamehub_access_token');
export function searchPlayers(q) {
  return request(`/friends/search?q=${encodeURIComponent(q)}`, { token: authToken() });
}
export function getFriends() {
  return request('/friends', { token: authToken() });
}
export function getFriendRequests() {
  return request('/friends/requests', { token: authToken() });
}
export function sendFriendRequest(userId) {
  return request('/friends/requests', { method: 'POST', token: authToken(), body: JSON.stringify({ userId }) });
}
export function respondFriendRequest(id, action) {
  return request(`/friends/requests/${id}`, { method: 'PATCH', token: authToken(), body: JSON.stringify({ action }) });
}
export function removeFriend(userId) {
  return request(`/friends/${userId}`, { method: 'DELETE', token: authToken() });
}
export function sendHeartbeat() {
  return request('/friends/heartbeat', { method: 'POST', token: authToken() });
}
