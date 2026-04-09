import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFirestoreError, OperationType } from './firebase';

// Mock firebase configuration imports
vi.mock('../../firebase-applet-config.json', () => ({
  default: {
    firestoreDatabaseId: 'test-db'
  }
}));

// Mock firebase/app
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
}));

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  Timestamp: {},
  serverTimestamp: vi.fn(),
  getDocFromServer: vi.fn(),
}));

// Mock firebase/auth
vi.mock('firebase/auth', () => {
  const mockAuth = {
    currentUser: null as any
  };
  return {
    getAuth: vi.fn(() => mockAuth),
    GoogleAuthProvider: class {},
    signInWithPopup: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    _mockAuth: mockAuth
  };
});
import { _mockAuth as mockAuth } from 'firebase/auth';

describe('handleFirestoreError', () => {
  beforeEach(() => {
    mockAuth.currentUser = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(console.error).mockClear();
  });

  it('maps string error correctly', () => {
    expect(() => {
      handleFirestoreError('test string error', OperationType.CREATE, 'test/path');
    }).toThrow();

    const consoleSpy = vi.mocked(console.error);
    expect(consoleSpy).toHaveBeenCalled();
    const errorLogStr = consoleSpy.mock.calls[0][1];
    const parsedLog = JSON.parse(errorLogStr);

    expect(parsedLog.error).toBe('test string error');
    expect(parsedLog.operationType).toBe('create');
    expect(parsedLog.path).toBe('test/path');
  });

  it('maps Error instance correctly', () => {
    expect(() => {
      handleFirestoreError(new Error('test instance error'), OperationType.GET, 'other/path');
    }).toThrow();

    const consoleSpy = vi.mocked(console.error);
    const errorLogStr = consoleSpy.mock.calls[0][1];
    const parsedLog = JSON.parse(errorLogStr);

    expect(parsedLog.error).toBe('test instance error');
    expect(parsedLog.operationType).toBe('get');
    expect(parsedLog.path).toBe('other/path');
  });

  it('handles null currentUser', () => {
    // Need to cast the OperationType since READ wasn't exported in the enum but we want a valid one.
    expect(() => {
      handleFirestoreError(new Error('error'), OperationType.GET, null);
    }).toThrow();

    const consoleSpy = vi.mocked(console.error);
    const errorLogStr = consoleSpy.mock.calls[0][1];
    const parsedLog = JSON.parse(errorLogStr);

    expect(parsedLog.authInfo).toEqual({
      userId: undefined,
      email: undefined,
      emailVerified: undefined,
      isAnonymous: undefined,
      tenantId: undefined,
      providerInfo: []
    });
  });

  it('handles populated currentUser', () => {
    mockAuth.currentUser = {
      uid: 'user123',
      email: 'test@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: 'tenant1',
      providerData: [
        {
          providerId: 'google.com',
          displayName: 'Test User',
          email: 'test@example.com',
          photoURL: 'http://example.com/photo.jpg'
        }
      ]
    };

    expect(() => {
      handleFirestoreError(new Error('error'), OperationType.UPDATE, 'path/1');
    }).toThrow();

    const consoleSpy = vi.mocked(console.error);
    const errorLogStr = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][1];
    const parsedLog = JSON.parse(errorLogStr);

    expect(parsedLog.authInfo).toEqual({
      userId: 'user123',
      email: 'test@example.com',
      emailVerified: true,
      isAnonymous: false,
      tenantId: 'tenant1',
      providerInfo: [
        {
          providerId: 'google.com',
          displayName: 'Test User',
          email: 'test@example.com',
          photoUrl: 'http://example.com/photo.jpg'
        }
      ]
    });
  });
});
