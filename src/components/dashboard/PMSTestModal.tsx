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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const { toast } = useToast();

  const tests = [
    { name: 'Connection Test', key: 'ping' },
    { name: 'List Providers', key: 'providers' },
    { name: 'List Locations', key: 'locations' },
    { name: 'Search Patient', key: 'search_patient' },
  ];

  const runSingleTest = async (action: string): Promise<any> => {
    console.log(`Running PMS test: ${action} for office: ${officeId}`)
    
    const { data, error } = await supabase.functions.invoke("pms-test", {
      body: { office_id: officeId, action }
    });

    console.log(`PMS test response for ${action}:`, { data, error })

    if (error) {
      throw new Error(`Edge Function Error: ${error.message || 'Unknown error'}`);
    }

    if (!data.success) {
      throw new Error(data.error || 'Test failed');
    }

    return data;
  };

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
        console.log(`Starting test: ${test.name} (${test.key})`)
        const response = await runSingleTest(test.key);
        
        const duration = Date.now() - startTime;
        results[i] = {
          ...results[i],
          status: 'success',
          duration,
          data: response.data || response,
        };
        
        console.log(`Test ${test.name} passed in ${duration}ms`)
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`Test ${test.name} failed:`, error)
        
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
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    setIsRunning(false);
    
    const successCount = results.filter(r => r.status === 'success').length;
    toast({
      title: "PMS Test Complete",
      description: `${successCount}/${tests.length} tests passed`,
      variant: successCount === tests.length ? "default" : "destructive",
    });

    // Log audit entry if all tests pass
    if (successCount === tests.length) {
      try {
        console.log('All PMS tests passed, logging audit entry...')
        // You could add audit log entry here if needed
      } catch (auditError) {
        console.error('Failed to log audit entry:', auditError)
      }
    }
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