import axios from 'axios';
import { authApi, ordersApi } from '../api';
import { getCommerceErrorMessage, isValidQuantity } from '../utils/commerce';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    post: jest.fn(),
    delete: jest.fn(),
  })),
}));

const instance = axios.create.mock.results[0].value;
const rejectResponse = instance.interceptors.response.use.mock.calls[0][1];
const t = (key) => key;

test('order request excludes client prices, quantities and totals', () => {
  ordersApi.create({ address: 'Test street', phone: '1234567890', comment: 'cash', items: [{ price: 0.01, quantity: 99 }], total: 0.01 });
  expect(instance.post).toHaveBeenCalledWith('/orders', { address: 'Test street', phone: '1234567890', comment: 'cash' });
});

test.each([400, 403, 409])('preserves HTTP %s and backend message', async (status) => {
  const error = { response: { status, data: { error: 'Backend error' } } };
  await expect(rejectResponse(error)).rejects.toMatchObject({ status, message: 'Backend error', response: error.response });
});

test('shows field validation errors', async () => {
  const error = { response: { status: 400, data: { errors: [{ msg: 'Address required' }] } } };
  await expect(rejectResponse(error)).rejects.toMatchObject({ message: 'Address required' });
});

test.each([400, 409])('explains stock failure with HTTP %s', (status) => {
  expect(getCommerceErrorMessage({ status, message: 'Not enough stock' }, t)).toBe('commerce.insufficientStock');
});

test('explains account block and preserves other validation messages', () => {
  expect(getCommerceErrorMessage({ status: 403, message: 'Conta indisponível' }, t)).toBe('commerce.accountBlocked');
  expect(getCommerceErrorMessage({ status: 400, message: 'Address required' }, t)).toBe('Address required');
});

test.each([0, -1, 100, 1.5, '1', null, undefined, NaN, true])('rejects non-contract quantity %s', (value) => {
  expect(isValidQuantity(value)).toBe(false);
});

test('accepts both quantity boundaries', () => {
  expect(isValidQuantity(1)).toBe(true);
  expect(isValidQuantity(99)).toBe(true);
});

const session = require('../authSession');

test.each([
  [401, 'Token expired'],
  [403, 'Conta bloqueada'],
  [403, 'Sua conta está bloqueada'],
  [403, 'Conta indisponível'],
  [403, 'Blocked account'],
])('invalidates a session on %s %s', async (status, message) => {
  session.setAccessToken('active-token');
  localStorage.setItem('accessToken', 'active-token');
  const listener = jest.fn();
  window.addEventListener(session.AUTH_SESSION_INVALIDATED, listener);
  try {
    await expect(rejectResponse({ response: { status, data: { error: message } } })).rejects.toMatchObject({ status });
    expect(session.getAccessToken()).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(session.canRestoreSession()).toBe(false);
    expect(listener).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener(session.AUTH_SESSION_INVALIDATED, listener);
  }
});

test('role-based 403 does not log the user out', async () => {
  session.setAccessToken('valid-token');
  await expect(rejectResponse({ response: { status: 403, data: { error: 'Permissões insuficientes' } } })).rejects.toMatchObject({ status: 403 });
  expect(session.getAccessToken()).toBe('valid-token');
});

test('an old session error cannot log out a newly signed-in user', async () => {
  const version = session.getSessionVersion();
  session.setAccessToken('new-token');
  await expect(rejectResponse({ config: { _sessionVersion: version }, response: { status: 401 } })).rejects.toMatchObject({ status: 401 });
  expect(session.getAccessToken()).toBe('new-token');
});

test('deactivation uses the authenticated profile endpoint', () => {
  authApi.deactivateProfile();
  expect(instance.delete).toHaveBeenCalledWith('/auth/profile');
});
