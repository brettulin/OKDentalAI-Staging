import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthProvider } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Phone, Users, Calendar, Settings, LogOut } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { DebugPanel } from '@/components/debug/DebugPanel';

interface LayoutProps {
  children: React.ReactNode;
}

const AuthCard = () => {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email);
      toast({
        title: "Magic link sent!",
        description: "Check your email for the sign-in link.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send magic link. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Dental Voice AI</CardTitle>
          <CardDescription>Sign in to access your clinic dashboard</CardDescription>
        </CardHeader>
        <CardContent>
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

  const menuItems = [
    { icon: Phone, label: 'Calls', href: '#calls' },
    { icon: Users, label: 'Patients', href: '#patients' },
    { icon: Calendar, label: 'Appointments', href: '#appointments' },
    { icon: Settings, label: 'Settings', href: '#settings' },
  ];

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
              <a
                href={item.href}
                className="flex items-center space-x-3 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </a>
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
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <AuthProvider>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading...</p>
          </div>
        </div>
        <DebugPanel />
      </AuthProvider>
    );
  }

  if (!user) {
    return (
      <AuthProvider>
        <AuthCard />
        <DebugPanel />
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <div className="min-h-screen bg-background">
        <div className="flex">
          <Sidebar />
          <main className="flex-1">
            {children}
          </main>
        </div>
        <DebugPanel />
      </div>
    </AuthProvider>
  );
};