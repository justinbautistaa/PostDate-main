import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Login from '../pages/Login';
import { clearToken, setSession } from '../auth';
import { loginUser } from '../services/postdateApi';
vi.mock('../services/postdateApi', () => ({ loginUser: vi.fn(), requestRecoveryCode: vi.fn(), verifyRecoveryCode: vi.fn(), resetPassword: vi.fn() }));
vi.mock('../components/VerificationModal', () => ({ default: () => null }));
vi.mock('../components/auth/MfaForm', () => ({ default: ({ onComplete }) => <button onClick={() => onComplete({ userId: 'me', role: 'user' })}>Complete MFA</button> }));
function HistoryControls() {
  const navigate = useNavigate();
  return <><button onClick={() => navigate(-1)}>Browser back</button><button onClick={() => navigate(1)}>Browser forward</button></>;
}
function setup(entries, index) {
  render(<MemoryRouter initialEntries={entries} initialIndex={index}><HistoryControls /><Routes>
    <Route path="/" element={<p>Public home</p>} />
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<p>Member dashboard</p>} />
    <Route path="/admin" element={<p>Admin dashboard</p>} />
    <Route path="/staff" element={<p>Staff dashboard</p>} />
  </Routes></MemoryRouter>);
}
beforeEach(() => { clearToken(); vi.resetAllMocks(); });
it.each([['user', 'Member'], ['admin', 'Admin'], ['moderator', 'Staff']])('redirects an authenticated %s away from a historical login entry', async (role, label) => {
  setSession({ userId: 'me', role });
  setup(['/', '/login']);
  await screen.findByText(`${label} dashboard`);
  expect(screen.queryByLabelText('Email address')).toBeNull();
  fireEvent.click(screen.getByText('Browser back'));
  await screen.findByText('Public home');
  fireEvent.click(screen.getByText('Browser forward'));
  await screen.findByText(`${label} dashboard`);
});
it.each([false, true])('replaces login history after successful authentication (MFA: %s)', async mfa => {
  loginUser.mockResolvedValue(mfa ? { mfaRequired: true } : { userId: 'me', role: 'user' });
  setup(['/', '/login']);
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'member@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'OriginalSecret123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Log-in' }));
  if (mfa) fireEvent.click(await screen.findByText('Complete MFA'));
  await screen.findByText('Member dashboard');
  fireEvent.click(screen.getByText('Browser back'));
  await screen.findByText('Public home');
  expect(screen.queryByLabelText('Email address')).toBeNull();
  fireEvent.click(screen.getByText('Browser forward'));
  await screen.findByText('Member dashboard');
});
it('still shows login after the session is cleared', () => {
  setSession({ userId: 'me', role: 'user' }); clearToken();
  setup(['/login']);
  expect(screen.getByLabelText('Email address')).toBeTruthy();
});
