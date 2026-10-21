import { useEffect, useState } from 'react';
import api from '../api';
import MfaSettings from './profile/MfaSettings';
import './StaffMfaReminder.css';

export default function StaffMfaReminder() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const { data } = await api.get('/auth/mfa/status');
        if (active) setStatus(data);
      } catch { /* The reminder does not block workspace access on failure. */ }
    }
    refresh();
    window.addEventListener('focus', refresh);
    const timer = setInterval(refresh, 30000);
    return () => { active = false; clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  if (!status?.recommended || status.enabled) return null;
  return <aside className="staff-mfa-reminder" aria-label="Account security reminder">
    <div role="status"><strong>Protect your new admin or staff access</strong><p>Your role has been updated. Enable authenticator MFA to help protect your account. You can continue using your workspace and set it up when you’re ready.</p></div>
    <button type="button" className="outline-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? 'Hide setup' : 'Set up MFA'}</button>
    {open && <MfaSettings onEnabled={() => setStatus(value => ({ ...value, enabled: true }))} />}
  </aside>;
}
