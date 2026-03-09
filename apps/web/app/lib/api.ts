export function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    cache: 'no-store',
    ...options,
  });
}