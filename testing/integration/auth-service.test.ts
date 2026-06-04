import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/firebase', () => ({
  auth: {
    currentUser: null,
    config: { authDomain: 'test.firebaseapp.com', apiKey: 'test-key' },
    app: { options: { projectId: 'test-project' } },
    onAuthStateChanged: vi.fn(),
  },
  db: {},
}));

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  doc: vi.fn().mockReturnValue({}),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => new Date()),
}));

vi.mock('@/lib/auth-errors', () => ({
  parseFirebaseError: vi.fn((err: any) => err.message ?? 'Auth error'),
}));

import * as firebaseAuth from 'firebase/auth';
import { AuthService } from '@/lib/auth-service';

describe('WAT Agent 1 — Auth Service (TC-2.1 / TC-2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── TC-2.1 Registration ───────────────────────────────────────────────
  describe('signUpWithEmail — Registration', () => {
    it('TC-2.1.1 PASS — valid data creates account', async () => {
      const mockUser = { uid: 'uid-001', email: 'jane@test.com' };
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);
      vi.mocked(firebaseAuth.updateProfile).mockResolvedValue(undefined);

      const user = await AuthService.signUpWithEmail('jane@test.com', 'SecurePass1!', 'Jane Doe');

      expect(user).toBeDefined();
      expect(user.uid).toBe('uid-001');
      expect(firebaseAuth.createUserWithEmailAndPassword).toHaveBeenCalledOnce();
    });

    it('TC-2.1.2 PASS — duplicate email throws error', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockRejectedValue({
        code: 'auth/email-already-in-use',
        message: 'The email address is already in use by another account.',
      });

      await expect(
        AuthService.signUpWithEmail('existing@test.com', 'Pass123!', 'Test User'),
      ).rejects.toThrow();
    });

    it('TC-2.1.3 PASS — weak password throws error', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockRejectedValue({
        code: 'auth/weak-password',
        message: 'Password should be at least 6 characters.',
      });

      await expect(
        AuthService.signUpWithEmail('user@test.com', '123', 'Test User'),
      ).rejects.toThrow();
    });

    it('TC-2.1.4 PASS — missing fields (empty email) throws error', async () => {
      vi.mocked(firebaseAuth.createUserWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-email',
        message: 'The email address is badly formatted.',
      });

      await expect(
        AuthService.signUpWithEmail('', 'Pass123!', 'Test User'),
      ).rejects.toThrow();
    });
  });

  // ── TC-2.2 Login & Session ────────────────────────────────────────────
  describe('signInWithEmail — Login', () => {
    it('TC-2.2.1 PASS — valid credentials return user', async () => {
      const mockUser = { uid: 'uid-002', email: 'rider@test.com' };
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as any);

      const user = await AuthService.signInWithEmail('rider@test.com', 'test123');

      expect(user.email).toBe('rider@test.com');
      expect(user.uid).toBe('uid-002');
    });

    it('TC-2.2.2 PASS — wrong password throws error', async () => {
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/wrong-password',
        message: 'The password is invalid.',
      });

      await expect(
        AuthService.signInWithEmail('rider@test.com', 'wrongpassword'),
      ).rejects.toThrow();
    });

    it('TC-2.2.3 PASS — unregistered email throws error', async () => {
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/user-not-found',
        message: 'There is no user record corresponding to this identifier.',
      });

      await expect(
        AuthService.signInWithEmail('nobody@test.com', 'anypassword'),
      ).rejects.toThrow();
    });

    it('TC-2.2.4 PASS — invalid email format throws error', async () => {
      vi.mocked(firebaseAuth.signInWithEmailAndPassword).mockRejectedValue({
        code: 'auth/invalid-email',
        message: 'The email address is badly formatted.',
      });

      await expect(
        AuthService.signInWithEmail('not-an-email', 'pass123'),
      ).rejects.toThrow();
    });
  });

  // ── TC-2.2 Session Management ─────────────────────────────────────────
  describe('session management', () => {
    it('TC-2.2.5 PASS — getCurrentUser returns null when unauthenticated', () => {
      const user = AuthService.getCurrentUser();
      expect(user).toBeNull();
    });

    it('TC-2.2.6 PASS — signOut resolves without error', async () => {
      vi.mocked(firebaseAuth.signOut).mockResolvedValue(undefined);

      await expect(AuthService.signOut()).resolves.not.toThrow();
      expect(firebaseAuth.signOut).toHaveBeenCalledOnce();
    });

    it('TC-2.2.7 PASS — signOut failure throws error', async () => {
      vi.mocked(firebaseAuth.signOut).mockRejectedValue({
        code: 'auth/network-request-failed',
        message: 'Network error',
      });

      await expect(AuthService.signOut()).rejects.toThrow();
    });
  });

  // ── TC-2.3 Google Sign-In (web only) ──────────────────────────────────
  // NOTE: Platform.OS is mocked as 'node' in the test environment.
  // signInWithGoogle is only supported on the web platform; mobile uses useGoogleAuth hook.
  describe('signInWithGoogle — non-web platform', () => {
    it('TC-2.3.1 PASS — throws on non-web platform, directing to hook usage', async () => {
      // Platform.OS = 'node' in test env → app redirects to hook-based OAuth
      await expect(AuthService.signInWithGoogle()).rejects.toThrow(
        'Google Sign In on mobile requires hook usage',
      );
    });
  });
});
