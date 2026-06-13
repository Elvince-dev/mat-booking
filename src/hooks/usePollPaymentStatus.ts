// frontend/src/hooks/usePollPaymentStatus.ts
import { useState, useEffect, useCallback } from 'react';
import { getBookingStatus, BookingStatus } from '../services/api';

export function usePollPaymentStatus(bookingId: number | null, onComplete: (status: BookingStatus) => void) {
  const [status, setStatus] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const poll = useCallback(async () => {
    if (!bookingId) return;
    try {
      const result = await getBookingStatus(bookingId);
      if (result.error) {
        setError(result.error);
        setIsPolling(false);
        return;
      }
      if (result.data) {
        setStatus(result.data);
        // If payment is confirmed or failed, stop polling
        if (result.data.status === 'confirmed' || result.data.status === 'payment_failed') {
          setIsPolling(false);
          onComplete(result.data);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsPolling(false);
    }
  }, [bookingId, onComplete]);

  useEffect(() => {
    if (!bookingId) return;
    setIsPolling(true);
    // Poll every 3 seconds
    const interval = setInterval(() => {
      poll();
    }, 3000);
    // Initial poll immediately
    poll();

    return () => clearInterval(interval);
  }, [bookingId, poll]);

  return { status, error, isPolling };
}