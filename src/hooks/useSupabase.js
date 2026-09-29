import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase/client';
import { toCamelCase, toSnakeColumn } from '../supabase/db';

const TABLE_MAP = {
  printJobs: 'print_jobs',
  users: 'merchants',
  merchants: 'merchants',
};

/**
 * Hook to subscribe to a Supabase table in real-time.
 * Uses unlimited PostgREST API requests and Supabase Realtime WebSocket changes.
 *
 * @param {string} collectionName The collection or table name ('printJobs', 'users', 'merchants')
 * @param {object} condition Optional filter { fieldName, operator, value }
 * @param {number} maxResults Maximum number of records to fetch (default: 100)
 */
export const useCollection = (collectionName, condition, maxResults = 100) => {
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const table = TABLE_MAP[collectionName] || collectionName;
  const fieldName = condition?.fieldName;
  const value = condition?.value;

  const filterColumn = fieldName ? toSnakeColumn(fieldName) : null;

  // 1. Data fetch effect (runs on mount, parameter changes, and manual refetchTrigger)
  useEffect(() => {
    // If condition is specified but value is not ready yet, return empty
    if (fieldName && (value === null || value === undefined)) {
      setDocuments([]);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      try {
        let query = supabase.from(table).select('*');

        if (filterColumn && value !== undefined && value !== null) {
          query = query.eq(filterColumn, value);
        }

        query = query.order('created_at', { ascending: false }).limit(maxResults);

        const { data, error: fetchErr } = await query;
        if (fetchErr) throw fetchErr;

        if (isMounted) {
          const fetchedDocs = (data || []).map(toCamelCase);
          setDocuments((prevDocs) => {
            if (!prevDocs || prevDocs.length === 0) {
              return fetchedDocs;
            }
            // Preserve any records inserted via Realtime before initial query resolved
            const fetchedIds = new Set(fetchedDocs.map((d) => d.id));
            const realtimeInserts = prevDocs.filter((d) => !fetchedIds.has(d.id));
            return [...realtimeInserts, ...fetchedDocs];
          });
          setError(null);
        }
      } catch (err) {
        console.error(`Error fetching from Supabase table ${table}:`, err);
        if (isMounted) {
          setError('Could not fetch data from database.');
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [table, filterColumn, fieldName, value, maxResults, refreshTrigger]);

  // 2. Realtime subscription effect (stable: not torn down on manual refetchTrigger)
  useEffect(() => {
    if (fieldName && (value === null || value === undefined)) {
      return;
    }

    let isMounted = true;
    const channelId = `realtime_${table}_${filterColumn ? `${filterColumn}_${value}` : 'all'}`;
    const channelConfig = {
      event: '*',
      schema: 'public',
      table,
    };

    if (filterColumn && value !== undefined && value !== null) {
      channelConfig.filter = `${filterColumn}=eq.${value}`;
    }

    const channel = supabase
      .channel(channelId)
      .on('postgres_changes', channelConfig, (payload) => {
        if (!isMounted) return;

        const { eventType, new: newRecord, old: oldRecord } = payload;

        setDocuments((prevDocs) => {
          const current = prevDocs ? [...prevDocs] : [];

          if (eventType === 'INSERT') {
            const transformed = toCamelCase(newRecord);
            // Prepend new job to the list if not already present, trimming to maxResults
            if (!current.some((d) => d.id === transformed.id)) {
              const updated = [transformed, ...current];
              return updated.length > maxResults ? updated.slice(0, maxResults) : updated;
            }
            return current;
          }

          if (eventType === 'UPDATE') {
            const transformed = toCamelCase(newRecord);
            return current.map((d) => (d.id === transformed.id ? transformed : d));
          }

          if (eventType === 'DELETE') {
            const targetId = oldRecord?.id;
            return current.filter((d) => d.id !== targetId);
          }

          return current;
        });
      })
      .subscribe((status, subErr) => {
        if (subErr) {
          console.error(`Supabase Realtime subscription error for ${table}:`, subErr);
        }
      });

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn(`Error removing realtime channel for ${table}:`, err);
      }
    };
  }, [table, filterColumn, fieldName, value, maxResults]);

  return { documents, error, refetch };
};

/**
 * Hook to listen to a single document/row in Supabase in real-time.
 *
 * @param {string} collectionName The collection/table name
 * @param {string} id The unique record ID
 */
export const useDocument = (collectionName, id) => {
  const [document, setDocument] = useState(null);
  const [error, setError] = useState(null);

  const table = TABLE_MAP[collectionName] || collectionName;

  useEffect(() => {
    if (!id) {
      setDocument(null);
      return;
    }

    let isMounted = true;

    // 1. Initial fetch
    const fetchDoc = async () => {
      try {
        const { data, error: docErr } = await supabase
          .from(table)
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (docErr) throw docErr;

        if (isMounted) {
          if (data) {
            setDocument(toCamelCase(data));
            setError(null);
          } else {
            setDocument(null);
            setError('Record not found.');
          }
        }
      } catch (err) {
        console.error(`Error fetching document from ${table}:`, err);
        if (isMounted) {
          setError('Failed to fetch the document.');
        }
      }
    };

    fetchDoc();

    // 2. Real-time changes subscription for this specific record
    const channelId = `doc_${table}_${id}_${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'DELETE') {
            setDocument(null);
          } else if (payload.new) {
            setDocument(toCamelCase(payload.new));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      try {
        supabase.removeChannel(channel);
      } catch (err) {
        console.warn(`Error removing document channel for ${table}:`, err);
      }
    };
  }, [table, id]);

  return { document, error };
};
