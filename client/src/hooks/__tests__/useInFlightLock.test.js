import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import useInFlightLock from '../useInFlightLock';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('locks competing mutations synchronously before a rerender', async () => {
  const task = deferred();
  const quantity = jest.fn(() => task.promise);
  const remove = jest.fn();
  const { result } = renderHook(() => useInFlightLock());
  let pending;
  act(() => {
    const run = result.current[1];
    pending = run(quantity);
    run(quantity);
    run(remove);
  });
  expect(quantity).toHaveBeenCalledTimes(1);
  expect(remove).not.toHaveBeenCalled();
  expect(result.current[0]).toBe(true);
  await act(async () => { task.resolve(); await pending; });
  expect(result.current[0]).toBe(false);
  await act(async () => { await result.current[1](remove); });
  expect(remove).toHaveBeenCalledTimes(1);
});

test('releases the lock after a failed request and permits retry', async () => {
  const task = deferred();
  const { result } = renderHook(() => useInFlightLock());
  let pending;
  act(() => { pending = result.current[1](() => task.promise); });
  await act(async () => {
    task.reject(new Error('Not enough stock'));
    await expect(pending).rejects.toThrow('Not enough stock');
  });
  expect(result.current[0]).toBe(false);
  const retry = jest.fn();
  await act(async () => { await result.current[1](retry); });
  expect(retry).toHaveBeenCalledTimes(1);
});

test('releases the lock when the action throws synchronously', async () => {
  const { result } = renderHook(() => useInFlightLock());
  await act(async () => {
    await expect(result.current[1](() => { throw new Error('Invalid quantity'); })).rejects.toThrow('Invalid quantity');
  });
  expect(result.current[0]).toBe(false);
});

test('disables mutation buttons until the request completes', async () => {
  const task = deferred();
  const request = jest.fn(() => task.promise);
  function Buttons() {
    const [pending, run] = useInFlightLock();
    return <><button disabled={pending} onClick={() => run(request)}>Add</button><button disabled={pending} onClick={() => run(request)}>Delete</button></>;
  }
  render(<Buttons />);
  fireEvent.click(screen.getByText('Add'));
  expect(screen.getByText('Add').disabled).toBe(true);
  expect(screen.getByText('Delete').disabled).toBe(true);
  fireEvent.click(screen.getByText('Add'));
  fireEvent.click(screen.getByText('Delete'));
  expect(request).toHaveBeenCalledTimes(1);
  await act(async () => { task.resolve(); await task.promise; });
  expect(screen.getByText('Add').disabled).toBe(false);
  expect(screen.getByText('Delete').disabled).toBe(false);
});
