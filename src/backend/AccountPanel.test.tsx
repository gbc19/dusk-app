import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountPanel } from './AccountPanel';
import type { BackendClient } from './client';
afterEach(cleanup);
function fixture(initial: unknown = null) {
  let listener: (event: string, value: unknown) => void = () => {};
  const auth = {
    onAuthStateChange: vi.fn(fn => { listener = fn; return { data: { subscription: { unsubscribe: vi.fn() } } }; }),
    getSession: vi.fn(async () => ({ data: { session: initial }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: { email_confirmed_at: 'synthetic' } }, error: null })),
    startAutoRefresh: vi.fn(), stopAutoRefresh: vi.fn(),
    signUp: vi.fn(async () => ({ error: null })), signInWithPassword: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })), verifyOtp: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })), signOut: vi.fn(async () => ({ error: null })),
  };
  const rpc = vi.fn(async () => ({ error: null, data: 'synthetic-account' }));
  render(<AccountPanel client={{ auth, rpc } as unknown as BackendClient} />);
  screen.getByText('Local test account').parentElement!.setAttribute('open', '');
  return { auth, rpc, emit: (event: string, value: unknown) => act(() => listener(event, value)) };
}
async function ready() { await waitFor(() => expect(screen.queryByText('Please wait…')).not.toBeInTheDocument()); }
function fill() { fireEvent.change(screen.getByLabelText('Email', { exact: true }), { target: { value: 'synthetic@example.invalid' } }); fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: 'synthetic-password-1234' } }); }
describe('customer account controls', () => {
  it('registers only email and password and explains verification', async () => {
    const { auth } = fixture(); await ready(); fill(); fireEvent.click(screen.getByText('Register test account')); await ready();
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'synthetic@example.invalid', password: 'synthetic-password-1234' }); expect(screen.getByRole('status')).toHaveTextContent('verification code'); expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it('shows safe errors and clears credentials after failed login', async () => {
    const { auth } = fixture(); await ready(); auth.signInWithPassword.mockImplementationOnce(async () => { throw new Error('secret diagnostic'); }); fill(); fireEvent.click(screen.getByText('Sign in')); await ready();
    expect(screen.getByRole('status')).toHaveTextContent('Unable'); expect(screen.queryByText('secret diagnostic')).not.toBeInTheDocument(); expect(screen.getByLabelText('Password')).toHaveValue('');
  });
  it('supports recovery codes and clears code input', async () => {
    const { auth } = fixture(); await ready(); fill(); fireEvent.click(screen.getByText('Recover password')); await ready();
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('synthetic@example.invalid');
    fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } }); fireEvent.click(screen.getByText('Verify email code')); await ready();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'synthetic@example.invalid', token: '123456', type: 'recovery' }); expect(screen.getByLabelText('Email code')).toHaveValue('');
  });
  it('restores a session and validates the account with the backend', async () => {
    const { auth, rpc } = fixture({ access_token: 'synthetic' }); await waitFor(() => expect(screen.getByText('Signed in. Customer account available.')).toBeInTheDocument()); expect(auth.getUser).toHaveBeenCalled(); expect(rpc).toHaveBeenCalledWith('ensure_account', {});
    fireEvent.click(screen.getByText('Sign out')); await ready(); expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' }); expect(screen.getByText('Sign in')).toBeInTheDocument();
  });
  it('handles session expiry without preserving account details', async () => {
    const { emit } = fixture({ access_token: 'synthetic' }); await ready(); emit('SIGNED_OUT', null); expect(screen.getByText('Sign in')).toBeInTheDocument(); expect(screen.queryByText('Signed in. Customer account available.')).not.toBeInTheDocument();
  });
});
