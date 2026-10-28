const apiRoot = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

async function request(path, options = {}) {
  let response;
  try { response = await fetch(`${apiRoot}${path}`, { ...options, headers: { 'content-type': 'application/json', ...options.headers } }); }
  catch { throw new Error('The review server could not be reached. Start the backend and try again.'); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.message ?? `Request failed (${response.status}).`);
  return data;
}
export const api = {
  review: (payload, signal) => request('/api/review', { method: 'POST', body: JSON.stringify(payload), signal }),
  history: (page = 1) => request(`/api/reviews?page=${page}&limit=10`),
  reviewById: (id) => request(`/api/reviews/${encodeURIComponent(id)}`),
  stats: () => request('/api/stats'),
};
