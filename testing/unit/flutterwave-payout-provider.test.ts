import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('flutterwave-payout-provider (Flutterwave Transfers)', () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.FLUTTERWAVE_SECRET_KEY;

  beforeEach(() => {
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-payout-provider-tests';
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.FLUTTERWAVE_SECRET_KEY = originalKey;
  });

  it('maps the documented transfer statuses, never guessing on an unrecognized one', async () => {
    const { mapFlutterwaveTransferStatus } = await import('@/backend/lib/flutterwave-payout-provider');
    expect(mapFlutterwaveTransferStatus('NEW')).toBe('pending');
    expect(mapFlutterwaveTransferStatus('PENDING')).toBe('pending');
    expect(mapFlutterwaveTransferStatus('SUCCESSFUL')).toBe('successful');
    expect(mapFlutterwaveTransferStatus('FAILED')).toBe('failed');
    expect(mapFlutterwaveTransferStatus('SOMETHING_NEW')).toBe('unknown');
    expect(mapFlutterwaveTransferStatus(undefined)).toBe('unknown');
    // No reversed status is documented for Flutterwave transfers.
    expect(mapFlutterwaveTransferStatus('REVERSED')).toBe('unknown');
  });

  it('resolveFlutterwaveAccountName posts account_number + account_bank and returns the resolved name', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', message: 'Account details fetched', data: { account_number: '0690000032', account_name: 'Pastor Bright' } }),
    }) as any;
    const { resolveFlutterwaveAccountName } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await resolveFlutterwaveAccountName({ accountNumber: '0690000032', bankCode: '044' });

    expect(result.ok).toBe(true);
    expect(result.resolvedAccountName).toBe('Pastor Bright');
    const [url, requestInit] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.flutterwave.com/v3/accounts/resolve');
    expect(JSON.parse(requestInit.body)).toEqual({ account_number: '0690000032', account_bank: '044' });
  });

  it('resolveFlutterwaveAccountName reports a rejection without throwing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error', message: 'Sorry, that account number is invalid', data: null }),
    }) as any;
    const { resolveFlutterwaveAccountName } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await resolveFlutterwaveAccountName({ accountNumber: '0000000000', bankCode: '044' });

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Sorry, that account number is invalid');
  });

  it('initiateFlutterwaveTransfer sends naira as-is (no kobo conversion) and captures Flutterwave\'s own transfer id', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', message: 'Transfer Queued Successfully', data: { id: 26251, status: 'NEW', reference: 'PANTRA-PAYOUT-1' } }),
    }) as any;
    const { initiateFlutterwaveTransfer } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await initiateFlutterwaveTransfer({ amount: 5000, accountNumber: '0690000032', bankCode: '044', reference: 'PANTRA-PAYOUT-1' });

    expect(result.ok).toBe(true);
    expect(result.outcome).toBe('created');
    expect(result.providerTransferCode).toBe('26251');
    // NEW is not success — a created transfer is only ever pending.
    expect(result.providerState).toBe('pending');
    const [url, requestInit] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.flutterwave.com/v3/transfers');
    expect(JSON.parse(requestInit.body)).toMatchObject({
      account_bank: '044',
      account_number: '0690000032',
      amount: 5000,
      currency: 'NGN',
      reference: 'PANTRA-PAYOUT-1',
    });
  });

  it('detects a duplicate-reference rejection distinctly from a generic rejection', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ status: 'error', message: 'Transfer with reference already exists', data: null }),
    }) as any;
    const { initiateFlutterwaveTransfer } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await initiateFlutterwaveTransfer({ amount: 5000, accountNumber: '0690000032', bankCode: '044', reference: 'PANTRA-PAYOUT-1' });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('duplicate_reference');
  });

  it('a generic provider rejection is "rejected", not "duplicate_reference"', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ status: 'error', message: 'Insufficient balance', data: null }),
    }) as any;
    const { initiateFlutterwaveTransfer } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await initiateFlutterwaveTransfer({ amount: 5000, accountNumber: '0690000032', bankCode: '044', reference: 'PANTRA-PAYOUT-1' });

    expect(result.outcome).toBe('rejected');
    expect(result.message).toBe('Insufficient balance');
  });

  it('a network exception is reported as outcome "network_error", never as a confirmed failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('fetch failed')) as any;
    const { initiateFlutterwaveTransfer } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await initiateFlutterwaveTransfer({ amount: 5000, accountNumber: '0690000032', bankCode: '044', reference: 'PANTRA-PAYOUT-1' });

    expect(result.ok).toBe(false);
    expect(result.outcome).toBe('network_error');
    expect(result.providerState).toBe('unknown');
    expect(result.providerTransferCode).toBeNull();
  });

  it('verifyFlutterwaveTransfer looks up by Flutterwave\'s own id and returns the merchant reference for identity checks', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        message: 'Transfer fetched',
        data: { id: 1933222, status: 'SUCCESSFUL', amount: 5000, reference: 'PANTRA-PAYOUT-1', complete_message: 'Transaction was successful' },
      }),
    }) as any;
    const { verifyFlutterwaveTransfer } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await verifyFlutterwaveTransfer('1933222');

    expect(result.found).toBe(true);
    expect(result.providerState).toBe('successful');
    expect(result.amount).toBe(5000); // naira, not divided by 100
    expect(result.reference).toBe('PANTRA-PAYOUT-1');
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://api.flutterwave.com/v3/transfers/1933222');
  });

  it('verifyFlutterwaveTransfer reports not found rather than throwing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error', message: 'Transfer not found', data: null }),
    }) as any;
    const { verifyFlutterwaveTransfer } = await import('@/backend/lib/flutterwave-payout-provider');

    const result = await verifyFlutterwaveTransfer('999');

    expect(result.found).toBe(false);
    expect(result.reference).toBeNull();
  });

  it('every function degrades to a clean result when the secret key is missing, never calling the network', async () => {
    process.env.FLUTTERWAVE_SECRET_KEY = '';
    global.fetch = vi.fn() as any;
    const mod = await import('@/backend/lib/flutterwave-payout-provider');

    expect((await mod.resolveFlutterwaveAccountName({ accountNumber: '0690000032', bankCode: '044' })).ok).toBe(false);
    expect((await mod.initiateFlutterwaveTransfer({ amount: 1, accountNumber: '0690000032', bankCode: '044', reference: 'r' })).outcome).toBe('rejected');
    expect((await mod.verifyFlutterwaveTransfer('1')).found).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
