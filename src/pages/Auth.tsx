import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSecurityLimits } from '@/hooks/useSecurityLimits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordStrengthIndicator } from '@/components/security/PasswordStrengthIndicator';
import { Mail, Key, LogIn, UserPlus, Shield, Clock, AlertTriangle } from 'lucide-react';

export default function Auth() {
  const { signIn, signInWithPassword, signUp, resetPassword, error, clearError } = useAuth();
  const { 
    isAccountLocked, 
    failedAttempts, 
    lockoutTimeRemaining, 
    checkRateLimit, 
    recordFailedAttempt, 
    resetFailedAttempts,
    requireMagicLinkForSensitive,
    setRequireMagicLinkForSensitive 
  } = useSecurityLimits();
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [authMethod, setAuthMethod] = useState<'password' | 'magic'>('password');
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Remember user preferences
  useEffect(() => {
    const savedEmail = localStorage.getItem('auth_remember_email');
    const savedMethod = localStorage.getItem('auth_method') as 'password' | 'magic';
    if (savedEmail) setEmail(savedEmail);
    if (savedMethod) setAuthMethod(savedMethod);
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check account lockout
    if (isAccountLocked) {
      return;
    }
    
    // Check rate limiting
    if (!checkRateLimit('signin')) {
      clearError();
      return;
    }
    
    setIsLoading(true);
    clearError();

    // Save preferences if remember me is checked
    if (rememberMe) {
      localStorage.setItem('auth_remember_email', email);
      localStorage.setItem('auth_method', authMethod);
    } else {
      localStorage.removeItem('auth_remember_email');
      localStorage.removeItem('auth_method');
    }

    try {
      let result;
      if (authMethod === 'password') {
        result = await signInWithPassword(email, password);
      } else {
        result = await signIn(email);
      }
      
      if (result.error) {
        recordFailedAttempt();
      } else {
        resetFailedAttempts();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    
    // Check rate limiting
    if (!checkRateLimit('signup')) {
      return;
    }
    
    setIsLoading(true);
    clearError();

    try {
      await signUp(email, password);
    } finally {
      setIsLoading(false);
    }
  };

const MAX_FAILED_ATTEMPTS = 5;

  const validatePassword = (pwd: string): boolean => {
    return pwd.length >= 8 && 
           /[A-Z]/.test(pwd) && 
           /[a-z]/.test(pwd) && 
           /[0-9]/.test(pwd) &&
           /[!@#$%^&*(),.?":{}|<>]/.test(pwd); // Added special character requirement
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      const result = await resetPassword(resetEmail);
      if (!result.error) {
        setResetSuccess(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (showResetForm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold">Reset Password</h1>
            <p className="text-muted-foreground mt-2">We'll send you a link to reset your password</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Password Reset</CardTitle>
            </CardHeader>
            <CardContent>
              {resetSuccess ? (
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <Mail className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Check your email</h3>
                    <p className="text-muted-foreground">We've sent a password reset link to {resetEmail}</p>
                  </div>
                  <Button 
                    onClick={() => {
                      setShowResetForm(false);
                      setResetSuccess(false);
                      setResetEmail('');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Back to Sign In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label htmlFor="reset-email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reset-email"
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading || !resetEmail}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                  </Button>

                  <Button 
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowResetForm(false)}
                  >
                    Back to Sign In
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">AI Dental Receptionist</h1>
          <p className="text-muted-foreground mt-2">Secure access to your clinic's AI assistant</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4">
                <div className="flex items-center justify-center space-x-4 mb-4">
                  <Button
                    variant={authMethod === 'password' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuthMethod('password')}
                    className="flex items-center gap-2"
                  >
                    <Key className="h-4 w-4" />
                    Password
                  </Button>
                  <Button
                    variant={authMethod === 'magic' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAuthMethod('magic')}
                    className="flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    Magic Link
                  </Button>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  {authMethod === 'password' && (
                    <div>
                      <label htmlFor="signin-password" className="block text-sm font-medium mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="pl-10"
                          placeholder="Enter your password"
                          required
                        />
                      </div>
                    </div>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {isAccountLocked && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Account locked due to failed attempts. Try again in {Math.ceil(lockoutTimeRemaining / 60000)} minutes.
                      </AlertDescription>
                    </Alert>
                  )}

                  {failedAttempts > 0 && !isAccountLocked && (
                    <Alert variant="destructive">
                      <AlertDescription>
                        {failedAttempts}/{MAX_FAILED_ATTEMPTS} failed attempts. Account will be locked after {MAX_FAILED_ATTEMPTS} attempts.
                      </AlertDescription>
                    </Alert>
                  )}

                  {authMethod === 'password' && (
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="remember" 
                        checked={rememberMe}
                        onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                      />
                      <label
                        htmlFor="remember"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Remember me on this device
                      </label>
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || isAccountLocked || (authMethod === 'password' && !password)}
                  >
                    {isLoading ? 
                      (authMethod === 'password' ? 'Signing In...' : 'Sending...') : 
                      (authMethod === 'password' ? 'Sign In' : 'Send Magic Link')
                    }
                  </Button>

                  {/* Security Enhancement Toggle */}
                  <div className="border-t pt-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="require-magic-link" 
                        checked={requireMagicLinkForSensitive}
                        onCheckedChange={(checked) => setRequireMagicLinkForSensitive(checked as boolean)}
                      />
                      <label
                        htmlFor="require-magic-link"
                        className="text-xs text-muted-foreground leading-none"
                      >
                        Require magic link verification for sensitive operations
                      </label>
                    </div>
                  </div>
                </form>

                {authMethod === 'password' && (
                  <div className="text-center space-y-2">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setAuthMethod('magic')}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Forgot password? Use magic link instead
                    </Button>
                    <div className="text-xs text-muted-foreground">or</div>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setShowResetForm(true)}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Reset password via email
                    </Button>
                  </div>
                )}

                <div className="text-center text-sm text-muted-foreground">
                  {authMethod === 'password' ? 
                    'Enter your password to sign in securely' :
                    "We'll send you a secure magic link to sign in"
                  }
                </div>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label htmlFor="signup-email" className="block text-sm font-medium mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        placeholder="Create a strong password"
                        required
                      />
                    </div>
                    {password && (
                      <div className="mt-3">
                        <PasswordStrengthIndicator password={password} />
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        placeholder="Confirm your password"
                        required
                      />
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <div className="text-sm text-destructive mt-1">
                        Passwords do not match
                      </div>
                    )}
                  </div>

                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || password !== confirmPassword || !password || !validatePassword(password)}
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground space-y-2">
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Password requirements: 8+ chars, uppercase, lowercase, number, special character</span>
                  </div>
                  <div>Your account will be created with secure password authentication</div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-xs text-muted-foreground">
          Healthcare-grade security • HIPAA compliant
        </div>
      </div>
    </div>
  );
}