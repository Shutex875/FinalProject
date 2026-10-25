export const AUTH_SESSION_INVALIDATED = 'auth:session-invalidated';
const LOGGED_OUT_KEY = 'auth:logged-out';
let accessToken = null;
let version = 0;

export const getSessionVersion = () => version;
export const getAccessToken = () => accessToken;
export const canRestoreSession = () => sessionStorage.getItem(LOGGED_OUT_KEY) !== 'true';
export const setAccessToken = (token) => {
  accessToken = token;
  version += 1;
  if (token) sessionStorage.removeItem(LOGGED_OUT_KEY);
};

export const invalidateSession = () => {
  accessToken = null;
  version += 1;
  localStorage.removeItem('accessToken');
  // An existing cookie must not silently sign the user back in after logout.
  sessionStorage.setItem(LOGGED_OUT_KEY, 'true');
  window.dispatchEvent(new Event(AUTH_SESSION_INVALIDATED));
};
