// Defaults to the same machine the page was served from, so opening the host on
// http://<your-LAN-IP>:5173 makes the QR code work for phones on the same Wi-Fi.
const { protocol, hostname } = window.location;

export const API_URL: string = import.meta.env.VITE_API_URL ?? `${protocol}//${hostname}:3000`;

export const CONTROLLER_URL: string =
  import.meta.env.VITE_CONTROLLER_URL ?? `${protocol}//${hostname}:8081`;
