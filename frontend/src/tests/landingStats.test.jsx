import React from 'react';
import { expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../pages/Home';
import { getLandingStats } from '../services/postdateApi';
vi.mock('../services/postdateApi', () => ({ getLandingStats: vi.fn() }));

it('renders the API numeric values, including zero, in the community statistics', async () => {
  getLandingStats.mockResolvedValue([
    { label: 'verified members', value: 1234 },
    { label: 'active matches', value: 0 },
    { label: 'members active recently', value: 2 },
  ]);
  render(<MemoryRouter><Home /></MemoryRouter>);
  const stats = await screen.findByRole('region', { name: 'Community at a glance' });
  expect(within(stats).getByText('1,234')).toBeTruthy();
  expect(within(stats).getByText('0')).toBeTruthy();
  expect(within(stats).getByText('2')).toBeTruthy();
});
