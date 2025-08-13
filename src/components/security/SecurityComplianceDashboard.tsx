import React, { useState, useEffect } from 'react';
import { useSecurityMonitoring } from '@/hooks/useSecurityMonitoring';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  Settings, 
  Download,
  Clock,
  Users,
  Database,
  Activity
} from 'lucide-react';

export const SecurityComplianceDashboard: React.FC = () => {
  const { profile } = useAuth();
  const { anomalies, config, updateConfig, generateComplianceReport } = useSecurityMonitoring();
  const [complianceReport, setComplianceReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const report = await generateComplianceReport(
        new Date(reportPeriod.startDate),
        new Date(reportPeriod.endDate)
      );
      setComplianceReport(report);
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const downloadReport = () => {
    if (!complianceReport) return;
    
    const blob = new Blob([JSON.stringify(complianceReport, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance_report_${reportPeriod.startDate}_to_${reportPeriod.endDate}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6" />
            Security & Compliance Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor security events and maintain HIPAA compliance
          </p>
        </div>
      </div>

      <Tabs defaultValue="monitoring" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitoring">Real-time Monitoring</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Reporting</TabsTrigger>
          <TabsTrigger value="settings">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="monitoring" className="space-y-6">
          {/* Real-time Anomalies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Security Anomalies
                {anomalies.length > 0 && (
                  <Badge variant="destructive">{anomalies.length}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {anomalies.length === 0 ? (
                <div className="text-center py-6">
                  <Shield className="h-12 w-12 text-green-600 mx-auto mb-2" />
                  <div className="text-lg font-medium text-green-600">All Clear</div>
                  <div className="text-sm text-muted-foreground">No security anomalies detected</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((anomaly, index) => (
                    <Alert key={index} variant={getSeverityColor(anomaly.severity) as any}>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{anomaly.description}</div>
                            <div className="text-sm opacity-75 mt-1">
                              {new Date(anomaly.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <Badge variant={getSeverityColor(anomaly.severity) as any}>
                            {anomaly.severity}
                          </Badge>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monitoring Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">Real-time Status</div>
                    <div className="text-xs text-muted-foreground">
                      {config.enableRealTimeAlerts ? 'Active' : 'Disabled'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <div>
                    <div className="text-sm font-medium">Access Threshold</div>
                    <div className="text-xs text-muted-foreground">
                      {config.maxAccessPerHour}/hour
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium">Business Hours</div>
                    <div className="text-xs text-muted-foreground">
                      {config.businessHoursStart}:00 - {config.businessHoursEnd}:00
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="text-sm font-medium">Patient Access</div>
                    <div className="text-xs text-muted-foreground">
                      {config.maxPatientAccessPerDay}/day
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          {/* Report Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Compliance Report
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={reportPeriod.startDate}
                    onChange={(e) => setReportPeriod(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={reportPeriod.endDate}
                    onChange={(e) => setReportPeriod(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button onClick={generateReport} disabled={reportLoading} className="flex-1">
                    {reportLoading ? 'Generating...' : 'Generate Report'}
                  </Button>
                  {complianceReport && (
                    <Button onClick={downloadReport} variant="outline">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Report Results */}
              {complianceReport && (
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className={`text-2xl font-bold ${getComplianceColor(complianceReport.compliance_score)}`}>
                          {complianceReport.compliance_score.toFixed(1)}%
                        </div>
                        <div className="text-sm text-muted-foreground">Compliance Score</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold">
                          {complianceReport.metrics.total_security_events}
                        </div>
                        <div className="text-sm text-muted-foreground">Security Events</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold">
                          {complianceReport.metrics.patient_data_access}
                        </div>
                        <div className="text-sm text-muted-foreground">Patient Access</div>
                      </CardContent>
                    </Card>
                  </div>

                  {complianceReport.recommendations.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">Recommendations</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1">
                          {complianceReport.recommendations.map((rec: string, index: number) => (
                            <li key={index} className="text-sm flex items-start gap-2">
                              <span className="text-yellow-600">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Monitoring Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="realtime">Real-time Alerts</Label>
                  <div className="text-sm text-muted-foreground">
                    Enable automatic anomaly detection and alerting
                  </div>
                </div>
                <Switch
                  id="realtime"
                  checked={config.enableRealTimeAlerts}
                  onCheckedChange={(checked) => updateConfig({ enableRealTimeAlerts: checked })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="maxAccess">Max Access Per Hour</Label>
                  <Input
                    id="maxAccess"
                    type="number"
                    value={config.maxAccessPerHour}
                    onChange={(e) => updateConfig({ maxAccessPerHour: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="maxPatient">Max Patient Access Per Day</Label>
                  <Input
                    id="maxPatient"
                    type="number"
                    value={config.maxPatientAccessPerDay}
                    onChange={(e) => updateConfig({ maxPatientAccessPerDay: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="startHour">Business Hours Start</Label>
                  <Input
                    id="startHour"
                    type="number"
                    min="0"
                    max="23"
                    value={config.businessHoursStart}
                    onChange={(e) => updateConfig({ businessHoursStart: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="endHour">Business Hours End</Label>
                  <Input
                    id="endHour"
                    type="number"
                    min="0"
                    max="23"
                    value={config.businessHoursEnd}
                    onChange={(e) => updateConfig({ businessHoursEnd: parseInt(e.target.value) })}
                  />
                </div>
              </div>

              <div>
                <Label>Alert Thresholds</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <Label htmlFor="lowThreshold" className="text-xs">Low</Label>
                    <Input
                      id="lowThreshold"
                      type="number"
                      value={config.alertThresholds.low}
                      onChange={(e) => updateConfig({ 
                        alertThresholds: { 
                          ...config.alertThresholds, 
                          low: parseInt(e.target.value) 
                        } 
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="mediumThreshold" className="text-xs">Medium</Label>
                    <Input
                      id="mediumThreshold"
                      type="number"
                      value={config.alertThresholds.medium}
                      onChange={(e) => updateConfig({ 
                        alertThresholds: { 
                          ...config.alertThresholds, 
                          medium: parseInt(e.target.value) 
                        } 
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="highThreshold" className="text-xs">High</Label>
                    <Input
                      id="highThreshold"
                      type="number"
                      value={config.alertThresholds.high}
                      onChange={(e) => updateConfig({ 
                        alertThresholds: { 
                          ...config.alertThresholds, 
                          high: parseInt(e.target.value) 
                        } 
                      })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};