interface PasswordStrength {
  score: number; // 0-4
  feedback: string[];
  isStrong: boolean;
}

export const validatePasswordStrength = (password: string): PasswordStrength => {
  const feedback: string[] = [];
  let score = 0;

  // Length check
  if (password.length >= 12) {
    score += 1;
  } else if (password.length >= 8) {
    score += 0.5;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }

  // Character variety checks
  if (/[a-z]/.test(password)) score += 0.5;
  else feedback.push('Include lowercase letters');

  if (/[A-Z]/.test(password)) score += 0.5;
  else feedback.push('Include uppercase letters');

  if (/[0-9]/.test(password)) score += 0.5;
  else feedback.push('Include numbers');

  if (/[^a-zA-Z0-9]/.test(password)) score += 0.5;
  else feedback.push('Include special characters (!@#$%^&*)');

  // Common patterns to avoid
  if (/(.)\1{2,}/.test(password)) {
    feedback.push('Avoid repeating characters');
    score -= 0.5;
  }

  if (/123|abc|qwe|password|admin|user/i.test(password)) {
    feedback.push('Avoid common patterns and words');
    score -= 1;
  }

  // Medical/healthcare specific patterns
  if (/clinic|medical|doctor|nurse|patient|health|care/i.test(password)) {
    feedback.push('Avoid healthcare-related words');
    score -= 0.5;
  }

  const finalScore = Math.max(0, Math.min(4, score));
  const isStrong = finalScore >= 3 && feedback.length === 0;

  return {
    score: finalScore,
    feedback,
    isStrong
  };
};

export const getPasswordStrengthText = (score: number): string => {
  if (score < 1) return 'Very Weak';
  if (score < 2) return 'Weak';
  if (score < 3) return 'Fair';
  if (score < 4) return 'Good';
  return 'Strong';
};

export const getPasswordStrengthColor = (score: number): string => {
  if (score < 1) return 'text-destructive';
  if (score < 2) return 'text-orange-600';
  if (score < 3) return 'text-yellow-600';
  if (score < 4) return 'text-blue-600';
  return 'text-green-600';
};