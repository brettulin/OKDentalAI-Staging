import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordStrengthIndicator } from '@/components/security/PasswordStrengthIndicator';
import { Mail, Key, LogIn, UserPlus } from 'lucide-react';

export default function Auth() {
  const { signIn, signInWithPassword, signUp, error, clearError } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');
  const [authMethod, setAuthMethod] = useState<'password' | 'magic'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearError();

    try {
      if (authMethod === 'password') {
        await signInWithPassword(email, password);
      } else {
        await signIn(email);
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
    
    setIsLoading(true);
    clearError();

    try {
      await signUp(email, password);
    } finally {
      setIsLoading(false);
    }
  };

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

                  <Button type="submit" className="w-full" disabled={isLoading || (authMethod === 'password' && !password)}>
                    {isLoading ? 
                      (authMethod === 'password' ? 'Signing In...' : 'Sending...') : 
                      (authMethod === 'password' ? 'Sign In' : 'Send Magic Link')
                    }
                  </Button>
                </form>

                {authMethod === 'password' && (
                  <div className="text-center">
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => setAuthMethod('magic')}
                      className="text-sm text-muted-foreground hover:text-primary"
                    >
                      Forgot password? Use magic link instead
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
                    disabled={isLoading || password !== confirmPassword || !password}
                  >
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                </form>

                <div className="text-center text-sm text-muted-foreground">
                  Your account will be created with password authentication
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