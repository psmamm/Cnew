import { useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { useApiMutation } from './useApi';

/**
 * Hook for automatically syncing user data to backend after Firebase authentication
 * Calls /api/auth/sync endpoint when user logs in
 */
export function useAuthSync(user: User | null) {
  const { mutate: syncUser } = useApiMutation('/api/auth/sync');
  const hasSyncedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      return;
    }

    const uid = user.uid;
    const email = user.email;

    // Skip if already synced for this user
    if (hasSyncedRef.current.has(uid)) {
      return;
    }

    // Only sync if we have both uid and email
    if (!uid || !email) {
      console.warn('Cannot sync user: missing uid or email');
      return;
    }

    // Sync user to backend
    syncUser({ uid, email })
      .then(() => {
        hasSyncedRef.current.add(uid);
        console.log('User synced successfully:', uid);
      })
      .catch((error) => {
        console.error('Failed to sync user:', error);
        // Don't add to synced set on error, so we can retry
      });
  }, [user, syncUser]);
}
