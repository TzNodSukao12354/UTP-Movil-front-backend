export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL
  || ""
).replace(/\/$/, "");

export function apiFetch(input, options = {}) {
  if (!API_URL) {
    throw new Error("Falta configurar EXPO_PUBLIC_API_URL con la dirección pública del backend.");
  }
  return fetch(input, options);
}
