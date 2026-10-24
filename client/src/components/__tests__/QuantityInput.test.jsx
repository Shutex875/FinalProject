import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import QuantityInput from '../QuantityInput';

jest.mock('antd', () => ({
  Button: ({ size, children, ...props }) => <button {...props}>{children}</button>,
  Input: ({ inputMode, ...props }) => <input {...props} />,
  Space: { Compact: ({ children }) => <div>{children}</div> },
}));

const Harness = ({ initial = 1, max, onChange }) => {
  const [value, setValue] = useState(initial);
  return <QuantityInput value={value} max={max} onChange={(next) => { setValue(next); onChange(next); }} />;
};

test('quantity controls stop at 1 and 99', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Quantity -' }).disabled).toBe(true);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } });
  expect(onChange).toHaveBeenLastCalledWith(99);
  expect(screen.getByRole('button', { name: 'Quantity +' }).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'ArrowUp' });
  expect(onChange).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Quantity -' }));
  expect(onChange).toHaveBeenLastCalledWith(98);
});

test.each(['0', '-1', '1.5', '1e2', '+2', 'abc', '100', '01'])('rejects invalid typed or pasted quantity %s', (text) => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: text } });
  expect(screen.getByRole('spinbutton').value).toBe('1');
  expect(onChange).not.toHaveBeenCalled();
});

test('allows replacing a cleared value and restores it on blur', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);
  const input = screen.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '' } });
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.blur(input);
  expect(input.value).toBe('1');
  fireEvent.change(input, { target: { value: '' } });
  fireEvent.change(input, { target: { value: '2' } });
  expect(onChange).toHaveBeenLastCalledWith(2);
});

test('respects a lower stock limit', () => {
  const onChange = jest.fn();
  render(<Harness initial={3} max={3} onChange={onChange} />);
  expect(screen.getByRole('button', { name: 'Quantity +' }).disabled).toBe(true);
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '4' } });
  expect(onChange).not.toHaveBeenCalled();
});
