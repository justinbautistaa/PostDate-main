import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginForm from '../components/auth/LoginForm';
it('shows the server cooldown after password throttling', async () => {
  const onSubmit = vi.fn().mockRejectedValue({ response: { status: 429, data: { retryAfter: 121 } } });
  render(<MemoryRouter><LoginForm onSubmit={onSubmit} /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'test@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'WrongPassword123!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log-in', exact: true }));
  expect((await screen.findByRole('alert')).textContent).toContain('Try again in 3 minute(s)');
});
