export const getAuthErrorMessage = (errorCode: string): string => {
  const errorMessages: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email. Please sign up first.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password. Please check your credentials and try again.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
    'auth/weak-password': 'Password should be at least 6 characters long.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled. Please contact support.',
    'auth/user-disabled': 'This account has been disabled. Please contact support.',
    'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes and try again.',
    'auth/network-request-failed': 'Network error. Please check your internet connection.',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Service temporarily unavailable. Please try again later.',
    'auth/invalid-api-key': 'Service temporarily unavailable. Please try again later.',
    'auth/app-not-authorized': 'Service configuration error. Please contact support.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/unauthorized-domain': 'Authentication not available on this domain.',
    'auth/account-exists-with-different-credential': 'An account with this email already exists using a different sign-in method.',
    'auth/requires-recent-login': 'Please log in again to complete this action.',
    'auth/expired-action-code': 'Verification code has expired. Please request a new one.',
    'auth/invalid-action-code': 'Invalid verification code. Please check and try again.',
    'auth/missing-verification-code': 'Please enter the verification code.',
    'auth/missing-verification-id': 'Verification session expired. Please try again.',
    'auth/invalid-phone-number': 'Please enter a valid phone number.',
    'auth/missing-phone-number': 'Please enter a phone number.',
    'auth/quota-exceeded': 'SMS quota exceeded. Please try again later.',
  };

  const lowerCaseCode = errorCode.toLowerCase();
  
  for (const [key, message] of Object.entries(errorMessages)) {
    if (lowerCaseCode.includes(key.toLowerCase())) {
      return message;
    }
  }

  return 'An unexpected error occurred. Please try again';
};

export const parseFirebaseError = (error: any): string => {
  if (!error) return 'An unexpected error occurred';

  const errorString = String(error.message || error.code || error);
  
  if (errorString.includes('auth/')) {
    const match = errorString.match(/auth\/[a-z0-9-._]+/i);
    if (match) {
      return getAuthErrorMessage(match[0]);
    }
  }

  return getAuthErrorMessage(errorString);
};
