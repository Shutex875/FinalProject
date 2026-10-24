import axios from 'axios';
import { ordersApi } from '../api';
import { getCommerceErrorMessage, isValidQuantity } from '../utils/commerce';

jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
    post: jest.fn(),
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
