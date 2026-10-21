import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StaffMfaReminder from '../components/StaffMfaReminder';
import api from '../api';
vi.mock('../api', () => ({ default: { get: vi.fn() } }));
vi.mock('../components/profile/MfaSettings', () => ({ default: ({ onEnabled }) => <section><h3>Authenticator security</h3><button onClick={onEnabled}>Finish test enrollment</button></section> }));
beforeEach(() => { vi.resetAllMocks(); });
it('shows a nonblocking reminder, opens optional setup and disappears after enrollment', async () => {
  api.get.mockResolvedValue({ data: { enabled: false, required: false, recommended: true } });
  render(<><h1>Workspace available</h1><StaffMfaReminder /></>);
  await screen.findByRole('complementary', { name: 'Account security reminder' });
  expect(screen.getByRole('heading', { name: 'Workspace available' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Authenticator security' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Set up MFA' }));
  expect(screen.getByRole('heading', { name: 'Authenticator security' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Finish test enrollment' }));
  expect(screen.queryByRole('complementary', { name: 'Account security reminder' })).toBeNull();
});
it.each([{ enabled: true, recommended: true }, { enabled: false, recommended: false }])('does not prompt enabled or ineligible accounts: %j', async status => {
  api.get.mockResolvedValue({ data: status });
  render(<StaffMfaReminder />);
  await vi.waitFor(() => expect(api.get).toHaveBeenCalledWith('/auth/mfa/status'));
  expect(screen.queryByRole('button', { name: 'Set up MFA' })).toBeNull();
});
