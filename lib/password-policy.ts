export interface PasswordPolicyResult {
  valid: boolean;
  message: string | null;
}

export const PASSWORD_POLICY_HINT =
  'At least 8 characters, with an uppercase letter, a lowercase letter, and a number.';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export function validatePassword(password: string): PasswordPolicyResult {
  if (!PASSWORD_RULE.test(password)) {
    return { valid: false, message: PASSWORD_POLICY_HINT };
  }
  return { valid: true, message: null };
}
