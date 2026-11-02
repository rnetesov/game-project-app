const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Произошла ошибка запроса');
  return data;
}

export function getServerHealth() { return request('/health'); }
export function registerUser(payload) { return request('/auth/register', { method: 'POST', body: JSON.stringify(payload) }); }
export function loginUser(payload) { return request('/auth/login', { method: 'POST', body: JSON.stringify(payload) }); }
export function getCurrentUser(token) { return request('/auth/me', { token }); }
export function getProfile(username) { return request('/profiles/' + encodeURIComponent(username)); }
export function updateMyProfile(payload) {
  const token = localStorage.getItem('gamehub_access_token');
  return request('/profiles/me', { method: 'PATCH', token, body: JSON.stringify(payload) });
}

const authToken = () => localStorage.getItem('gamehub_access_token');
export function searchPlayers(q) { return request('/friends/search?q=' + encodeURIComponent(q), { token: authToken() }); }
export function getFriends() { return request('/friends', { token: authToken() }); }
export function getFriendRequests() { return request('/friends/requests', { token: authToken() }); }
export function sendFriendRequest(userId) { return request('/friends/requests', { method: 'POST', token: authToken(), body: JSON.stringify({ userId }) }); }
export function respondFriendRequest(id, action) { return request('/friends/requests/' + id, { method: 'PATCH', token: authToken(), body: JSON.stringify({ action }) }); }
export function removeFriend(userId) { return request('/friends/' + userId, { method: 'DELETE', token: authToken() }); }
export function sendHeartbeat() { return request('/friends/heartbeat', { method: 'POST', token: authToken() }); }

export function getPosts({ cursor, limit = 10 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return request('/posts?' + params.toString(), { token: authToken() });
}
export function createPost(content) {
  return request('/posts', { method: 'POST', token: authToken(), body: JSON.stringify({ content }) });
}
export function deletePost(id) {
  return request('/posts/' + encodeURIComponent(id), { method: 'DELETE', token: authToken() });
}

export function togglePostLike(id) {
  return request('/posts/' + encodeURIComponent(id) + '/like', { method: 'PUT', token: authToken() });
}
export function getPostComments(id) {
  return request('/posts/' + encodeURIComponent(id) + '/comments', { token: authToken() });
}
export function createPostComment(id, content) {
  return request('/posts/' + encodeURIComponent(id) + '/comments', { method: 'POST', token: authToken(), body: JSON.stringify({ content }) });
}
export function deletePostComment(postId, commentId) {
  return request('/posts/' + encodeURIComponent(postId) + '/comments/' + encodeURIComponent(commentId), { method: 'DELETE', token: authToken() });
}

export function getNotifications(limit = 30) {
  return request('/notifications?limit=' + limit, { token: authToken() });
}
export function markNotificationRead(id) {
  return request('/notifications/' + encodeURIComponent(id) + '/read', { method: 'PATCH', token: authToken() });
}
export function markAllNotificationsRead() {
  return request('/notifications/read-all', { method: 'PATCH', token: authToken() });
}

export function getConversations() {
  return request('/conversations', { token: authToken() });
}
export function openConversation(userId) {
  return request('/conversations', { method: 'POST', token: authToken(), body: JSON.stringify({ userId }) });
}
export function getConversationMessages(id, options = {}) {
  const params = new URLSearchParams({ limit: String(options.limit || 30) });
  if (options.before) params.set('before', options.before);
  return request('/conversations/' + encodeURIComponent(id) + '/messages?' + params.toString(), { token: authToken() });
}
export function sendConversationMessage(id, content) {
  return request('/conversations/' + encodeURIComponent(id) + '/messages', { method: 'POST', token: authToken(), body: JSON.stringify({ content }) });
}
export function markConversationRead(id) {
  return request('/conversations/' + encodeURIComponent(id) + '/read', { method: 'PATCH', token: authToken() });
}
