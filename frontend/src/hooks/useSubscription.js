import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

export function useSubscription() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/subscription/me');
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useSubscriptionPlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/subscription/plans')
      .then(r => setPlans(r.data.plans || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading };
}
