import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function CallsExport() {
  const { profile } = useAuth();
  const [dateRange, setDateRange] = useState({
    start: format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });

  const { data: calls, isLoading } = useQuery({
    queryKey: ['calls-export', profile?.clinic_id, dateRange],
    queryFn: async () => {
      if (!profile?.clinic_id) return [];

      const { data, error } = await supabase
        .from('calls')
        .select(`
          *,
          turns(*)
        `)
        .eq('clinic_id', profile.clinic_id)
        .gte('started_at', `${dateRange.start}T00:00:00`)
        .lte('started_at', `${dateRange.end}T23:59:59`)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.clinic_id,
  });

  const exportToCsv = () => {
    if (!calls || calls.length === 0) {
      toast.error("No calls to export");
      return;
    }

    const csvHeaders = [
      'Call ID',
      'Date',
      'Start Time',
      'End Time',
      'Duration (seconds)',
      'Outcome',
      'Number of Turns',
      'Twilio Call SID'
    ];

    const csvRows = calls.map(call => {
      const startTime = new Date(call.started_at);
      const endTime = call.ended_at ? new Date(call.ended_at) : null;
      const duration = endTime ? Math.round((endTime.getTime() - startTime.getTime()) / 1000) : null;

      return [
        call.id,
        format(startTime, 'yyyy-MM-dd'),
        format(startTime, 'HH:mm:ss'),
        endTime ? format(endTime, 'HH:mm:ss') : 'N/A',
        duration || 'N/A',
        call.outcome || 'N/A',
        Array.isArray(call.turns) ? call.turns.length : 0,
        call.twilio_call_sid || 'N/A'
      ];
    });

    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `calls-export-${dateRange.start}-to-${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Calls exported successfully");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export Calls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {calls ? `${calls.length} calls found` : 'Loading...'}
          </div>
          <Button 
            onClick={exportToCsv}
            disabled={isLoading || !calls || calls.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}