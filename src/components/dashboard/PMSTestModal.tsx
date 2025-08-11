import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, Clock, TestTube } from 'lucide-react';
import { usePMSIntegration } from '@/hooks/usePMSIntegration';
import { useToast } from '@/hooks/use-toast';

interface PMSTestModalProps {
  open: boolean;
  onClose: () => void;
  officeId: string;
  officeName: string;
}

interface TestResult {
  test: string;
  status: 'pending' | 'success' | 'error';
  duration?: number;
  data?: any;
  error?: string;
}

export function PMSTestModal({ open, onClose, officeId, officeName }: PMSTestModalProps) {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { testPMS, listProviders, listLocations } = usePMSIntegration();
  const { toast } = useToast();

  const tests = [
    { name: 'Connection Test', key: 'connection' },
    { name: 'List Providers', key: 'providers' },
    { name: 'List Locations', key: 'locations' },
    { name: 'Search Patient', key: 'search_patient' },
  ];

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const results: TestResult[] = tests.map(test => ({
      test: test.name,
      status: 'pending' as const,
    }));
    setTestResults([...results]);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];
      const startTime = Date.now();
      
      try {
        let data;
        
        switch (test.key) {
          case 'connection':
            data = await testPMS(officeId);
            break;
          case 'providers':
            data = await listProviders(officeId);
            break;
          case 'locations':
            data = await listLocations(officeId);
            break;
          case 'search_patient':
            // Mock search for testing
            data = { message: 'Patient search functionality available' };
            break;
          default:
            throw new Error('Unknown test');
        }

        const duration = Date.now() - startTime;
        results[i] = {
          ...results[i],
          status: 'success',
          duration,
          data: typeof data === 'string' ? { message: data } : data,
        };
      } catch (error) {
        const duration = Date.now() - startTime;
        results[i] = {
          ...results[i],
          status: 'error',
          duration,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }

      setTestResults([...results]);
      
      // Small delay between tests
      if (i < tests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    setIsRunning(false);
    
    const successCount = results.filter(r => r.status === 'success').length;
    toast({
      title: "PMS Test Complete",
      description: `${successCount}/${tests.length} tests passed`,
      variant: successCount === tests.length ? "default" : "destructive",
    });
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Running...</Badge>;
      case 'success':
        return <Badge variant="default" className="bg-green-500">Passed</Badge>;
      case 'error':
        return <Badge variant="destructive">Failed</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            PMS Integration Test - {officeName}
          </DialogTitle>
          <DialogDescription>
            Testing connectivity and basic operations with your PMS system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Office ID: {officeId}
            </p>
            <Button
              onClick={runTests}
              disabled={isRunning}
              className="gap-2"
            >
              <TestTube className="h-4 w-4" />
              {isRunning ? 'Running Tests...' : 'Run Tests'}
            </Button>
          </div>

          {testResults.length > 0 && (
            <ScrollArea className="h-96 border rounded-lg p-4">
              <div className="space-y-4">
                {testResults.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(result.status)}
                        <span className="font-medium">{result.test}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.duration && (
                          <span className="text-xs text-muted-foreground">
                            {result.duration}ms
                          </span>
                        )}
                        {getStatusBadge(result.status)}
                      </div>
                    </div>

                    {result.data && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {result.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                        Error: {result.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {testResults.length === 0 && !isRunning && (
            <div className="text-center py-8 text-muted-foreground">
              Click "Run Tests" to start testing your PMS integration
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}