import React, { useEffect, useState } from 'react';
import { Button, Input, Space } from 'antd';
import { isValidQuantity } from '../utils/commerce';

export default function QuantityInput({ value, onChange, max = 99, disabled = false, size, label = 'Quantity' }) {
  const [draft, setDraft] = useState(String(value));
  const upperBound = Math.max(1, Math.min(99, max));

  useEffect(() => { setDraft(String(value)); }, [value, disabled]);

  const change = (next) => {
    if (isValidQuantity(next) && next <= upperBound && next !== value) {
      setDraft(String(next));
      onChange(next);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <Space.Compact>
      <Button size={size} disabled={disabled || value <= 1} onClick={() => change(value - 1)} aria-label={label + ' -'}>−</Button>
      <Input
        size={size}
        style={{ width: 64, textAlign: 'center' }}
        value={draft}
        disabled={disabled}
        inputMode="numeric"
        role="spinbutton"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={upperBound}
        aria-valuenow={value}
        onChange={(event) => {
          const text = event.target.value;
          if (text === '') setDraft('');
          else if (/^[1-9]\d?$/.test(text) && Number(text) <= upperBound) change(Number(text));
        }}
        onBlur={() => setDraft(String(value))}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            change(value + (event.key === 'ArrowUp' ? 1 : -1));
          } else if (event.key.length === 1 && !/\d/.test(event.key)) {
            event.preventDefault();
          }
        }}
      />
      <Button size={size} disabled={disabled || value >= upperBound} onClick={() => change(value + 1)} aria-label={label + ' +'}>+</Button>
    </Space.Compact>
  );
}
