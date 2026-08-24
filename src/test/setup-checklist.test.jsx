import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SetupChecklist from '../components/SetupChecklist';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

function healthResponse(setup) {
  return {
    ok: true,
    json: async () => ({ setup }),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('SetupChecklist', () => {
  it('refreshes setup status before retrying books', async () => {
    fetchMock
      .mockResolvedValueOnce(healthResponse({ storage: false, password: false, complete: false }))
      .mockResolvedValueOnce(healthResponse({ storage: true, password: false, complete: false }));
    const onRetry = vi.fn(async () => {});

    render(<SetupChecklist onRetry={onRetry} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/health');
    });
    expect(screen.getAllByText('To do')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Check again/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock.mock.invocationCallOrder[1]).toBeLessThan(onRetry.mock.invocationCallOrder[0]);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getAllByText('To do')).toHaveLength(1);
  });
});
