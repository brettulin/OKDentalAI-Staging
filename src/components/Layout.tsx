import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Phone, Users, Calendar, Settings, LogOut, Home, Database, Shield, BarChart3, Building, ClipboardCheck, Zap } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { DebugPanel } from '@/components/debug/DebugPanel';

interface LayoutProps {
  children: React.ReactNode;
}

const AuthCard = () => {
  const { signIn, error, clearError } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();
    
    const result = await signIn(email);
    
    if (result.error) {
      toast({
        title: "Error",
        description: result.error,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Magic link sent!",
        description: "Check your email for the sign-in link.",
      });
    }
    
    setLoading(false);
  };

  const handleRequestNewLink = () => {
    clearError();
    setEmail('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Dental Voice AI</CardTitle>
          <CardDescription>Sign in to access your clinic dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
              <div className="flex gap-2 mt-2">
                {error.includes('timeout') || error.includes('refresh') ? (
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-destructive underline text-sm"
                    onClick={() => window.location.reload()}
                  >
                    Refresh page
                  </Button>
                ) : null}
                {error.includes('expired') || error.includes('invalid') ? (
                  <Button 
                    variant="link" 
                    className="p-0 h-auto text-destructive underline text-sm"
                    onClick={handleRequestNewLink}
                  >
                    Request new link
                  </Button>
                ) : null}
              </div>
            </div>
          )}
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const Sidebar = () => {
  const { signOut } = useAuth();
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: 'Setup', href: '/' },
    { icon: Phone, label: 'Calls', href: '/calls' },
    { icon: Users, label: 'Patients', href: '/patients' },
    { icon: Calendar, label: 'Appointments', href: '/appointments' },
    { icon: Database, label: 'PMS Integration', href: '/pms' },
    { icon: BarChart3, label: 'Analytics', href: '/analytics' },
    { icon: ClipboardCheck, label: 'QA', href: '/qa' },
    { icon: Shield, label: 'Production', href: '/production' },
    { icon: Building, label: 'Enterprise', href: '/enterprise' },
    { icon: Zap, label: 'Optimization', href: '/optimization' },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ];

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-sidebar-foreground">Dental Voice AI</h1>
        <p className="text-sm text-sidebar-foreground/60">Admin Dashboard</p>
      </div>
      
      <Separator className="bg-sidebar-border" />
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item, index) => (
            <li key={index}>
              <Link
                to={item.href}
                className={`flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${
                  isActive(item.href)
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md max-w-md">
              <p className="text-sm text-destructive">{error}</p>
              <Button 
                variant="link" 
                className="p-0 h-auto text-destructive underline text-sm mt-1"
                onClick={() => window.location.reload()}
              >
                Refresh page
              </Button>
            </div>
          )}
        </div>
        <DebugPanel />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <AuthCard />
        <DebugPanel />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          {children}
        </main>
      </div>
      <DebugPanel />
    </div>
  );
};