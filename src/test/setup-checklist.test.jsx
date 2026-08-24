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
    const calls = [];
    fetchMock
      .mockImplementationOnce(async () => {
        calls.push('health-initial');
        return healthResponse({ storage: false, password: false, complete: false });
      })
      .mockImplementationOnce(async () => {
        calls.push('health-retry');
        return healthResponse({ storage: true, password: true, complete: true });
      });
    const onRetry = vi.fn(async () => {
      calls.push('books-retry');
    });

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
    expect(calls).toEqual(['health-initial', 'health-retry', 'books-retry']);
    expect(screen.getAllByText('Done')).toHaveLength(2);
  });

  it('updates partial setup progress without retrying books', async () => {
    fetchMock
      .mockResolvedValueOnce(healthResponse({ storage: false, password: false, complete: false }))
      .mockResolvedValueOnce(healthResponse({ storage: true, password: false, complete: false }));
    const onRetry = vi.fn(async () => {});

    render(<SetupChecklist onRetry={onRetry} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Check again/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
    expect(screen.getAllByText('To do')).toHaveLength(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('does not retry books when setup status cannot be refreshed', async () => {
    fetchMock
      .mockResolvedValueOnce(healthResponse({ storage: false, password: false, complete: false }))
      .mockRejectedValueOnce(new Error('health unavailable'));
    const onRetry = vi.fn(async () => {});

    render(<SetupChecklist onRetry={onRetry} />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /Check again/i }));

    await waitFor(() => {
      expect(screen.getByText(/The setup check did not answer/i)).toBeInTheDocument();
    });
    expect(onRetry).not.toHaveBeenCalled();
  });
});
