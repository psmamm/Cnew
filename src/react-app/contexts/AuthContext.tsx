import { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth';
import { auth, googleProvider, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useAuthSync } from '../hooks/useAuthSync';

const emitDebugLog = (payload: Record<string, unknown>) => {
  const url = 'http://127.0.0.1:7242/ingest/f3961031-a2d1-4bfa-88fe-0afd58d89888';
  const body = JSON.stringify(payload);
  try {
    fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body
    }).catch(() => {});
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  } catch {
    // ignore logging transport errors
  }
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: unknown }>;
  signUp: (email: string, password: string) => Promise<{ error: unknown }>;
  signOut: () => Promise<{ error: unknown }>;
  logout: () => Promise<{ error: unknown }>;
  resetPassword: (email: string) => Promise<{ error: unknown }>;
  signInWithGoogle: () => Promise<{ error: unknown }>;
  updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<{ error: unknown }>;
  uploadProfilePicture: (file: File) => Promise<{ error: unknown; url?: string }>;
  refreshUserData: () => Promise<User | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Auto-sync user to backend after authentication
  useAuthSync(user);

  const signIn = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // #region agent log
      emitDebugLog({
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'H3',
        location: 'AuthContext.tsx:signIn',
        message: 'Firebase email sign-in success',
        data: {
          emailProvided: Boolean(email)
        },
        timestamp: Date.now()
      });
      // #endregion
      return { error: null };
    } catch (error) {
      // #region agent log
      emitDebugLog({
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'H3',
        location: 'AuthContext.tsx:signIn',
        message: 'Firebase email sign-in error',
        data: {
          emailProvided: Boolean(email),
          errorCode: error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined,
          errorMessage: error && typeof error === 'object' && 'message' in error ? String(error.message) : undefined
        },
        timestamp: Date.now()
      });
      // #endregion
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      // #region agent log
      emitDebugLog({
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'H4',
        location: 'AuthContext.tsx:signInWithGoogle',
        message: 'Firebase Google sign-in success',
        data: {},
        timestamp: Date.now()
      });
      // #endregion
      return { error: null };
    } catch (error) {
      // #region agent log
      emitDebugLog({
        sessionId: 'debug-session',
        runId: 'run2',
        hypothesisId: 'H4',
        location: 'AuthContext.tsx:signInWithGoogle',
        message: 'Firebase Google sign-in error',
        data: {
          errorCode: error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined,
          errorMessage: error && typeof error === 'object' && 'message' in error ? String(error.message) : undefined
        },
        timestamp: Date.now()
      });
      // #endregion
      return { error };
    }
  };

  const updateUserProfile = async (data: { displayName?: string; photoURL?: string }) => {
    try {
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, data);
        setUser({ ...auth.currentUser });
        return { error: null };
      }
      return { error: 'No user logged in' };
    } catch (error) {
      return { error };
    }
  };

  const uploadProfilePicture = async (file: File): Promise<{ error: unknown; url?: string }> => {
    try {
      if (!auth.currentUser) {
        return { error: 'No user logged in' };
      }

      // Create a reference to the profile picture in Firebase Storage
      const storageRef = ref(storage, `profile-pictures/${auth.currentUser.uid}`);

      // Upload the file
      await uploadBytes(storageRef, file);

      // Get the download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update the user's profile with the new photo URL
      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      setUser({ ...auth.currentUser });

      return { error: null, url: downloadURL };
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      return { error };
    }
  };

  const refreshUserData = async () => {
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        setUser({ ...auth.currentUser });
        return auth.currentUser;
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh user data', error);
      return null;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    logout: signOut,
    resetPassword,
    signInWithGoogle,
    updateUserProfile,
    uploadProfilePicture,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
