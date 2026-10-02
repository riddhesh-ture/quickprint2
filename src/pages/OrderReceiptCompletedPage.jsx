// src/pages/OrderReceiptCompletedPage.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

/**
 * Clean Architecture V2: OrderReceiptCompletedPage is consolidated into
 * the unified OrderReceiptPendingPage with in-place Realtime green flip.
 */
export default function OrderReceiptCompletedPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const merchantId = searchParams.get('merchantId') || 'campus-library-04';
    const jobId = searchParams.get('jobId') || location.state?.order?.jobId || '';
    const query = jobId ? `?merchantId=${merchantId}&jobId=${jobId}` : `?merchantId=${merchantId}`;
    navigate(`/receipt/pending${query}`, { replace: true, state: location.state });
  }, [navigate, location.state, searchParams]);

  return null;
}
