import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import UserPage from '../UserPage';
import { useAuth } from '../../AuthContext';
import { likesApi } from '../../api';
import { message } from 'antd';

const mockNavigate = jest.fn();
const mockT = (key, options) => options?.defaultValue || key;
let mockConfirmation;
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: mockT }) }));
jest.mock('../../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../api', () => ({ likesApi: { getUserLikes: jest.fn() } }));
jest.mock('../../components/TemplateCard', () => () => null);
jest.mock('@ant-design/icons', () => ({ UserOutlined: () => null, ShoppingOutlined: () => null, EditOutlined: () => null }));
jest.mock('antd', () => {
  const Box = ({ children }) => <div>{children}</div>;
  const Form = Box;
  Form.useForm = () => [{ setFieldsValue: jest.fn() }];
  Form.Item = Box;
  return {
    Card: Box, Tag: Box, Space: Box, Row: Box, Col: Box, Empty: Box,
    Avatar: () => null, Tabs: () => null, Modal: () => null, Form, Input: () => null,
    Typography: { Title: Box, Text: Box },
    Button: ({ children, disabled, onClick }) => <button disabled={disabled} onClick={onClick}>{children}</button>,
    Popconfirm: (props) => { mockConfirmation = props; return <div>{props.description}{props.children}</div>; },
    message: { success: jest.fn(), error: jest.fn() },
  };
});

let deactivate;
beforeEach(() => {
  jest.clearAllMocks();
  deactivate = jest.fn();
  useAuth.mockReturnValue({ user: { id: 1, name: 'Customer' }, updateUser: jest.fn(), deactivateAccount: deactivate });
  likesApi.getUserLikes.mockResolvedValue([]);
});

test('warns about irreversible deactivation and waits for confirmation', async () => {
  render(<UserPage />);
  await waitFor(() => expect(likesApi.getUserLikes).toHaveBeenCalled());
  expect(screen.getByText(/Деактивация необратима/)).toBeTruthy();
  expect(mockConfirmation.description).toMatch(/история заказов сохранена/);
  expect(deactivate).not.toHaveBeenCalled();
});

test('locks confirmation and button until deactivation completes', async () => {
  let finish;
  deactivate.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  render(<UserPage />);
  await waitFor(() => expect(likesApi.getUserLikes).toHaveBeenCalled());
  let request;
  act(() => {
    const confirm = mockConfirmation.onConfirm;
    request = confirm();
    confirm();
  });
  expect(deactivate).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Деактивировать аккаунт' }).disabled).toBe(true);
  expect(mockConfirmation.okButtonProps.loading).toBe(true);
  await act(async () => { finish(); await request; });
  expect(message.success).toHaveBeenCalledWith(expect.stringMatching(/история заказов сохранена/));
  expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
});

test('shows failure and unlocks the deactivation button for retry', async () => {
  deactivate.mockRejectedValueOnce(new Error('Server unavailable'));
  render(<UserPage />);
  await waitFor(() => expect(likesApi.getUserLikes).toHaveBeenCalled());
  await act(async () => { await mockConfirmation.onConfirm(); });
  expect(message.error).toHaveBeenCalledWith('Server unavailable');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Деактивировать аккаунт' }).disabled).toBe(false);
});
