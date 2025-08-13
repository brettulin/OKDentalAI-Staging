import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useCareStackSync } from '@/hooks/useCareStackSync'
import { useCareStackAppointments } from '@/hooks/useCareStackAppointments'
import { useCareStackProcedures } from '@/hooks/useCareStackProcedures'
import { Calendar, Clock, Users, FileText, RotateCcw, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'

interface CareStackEnhancedDashboardProps {
  officeId: string
}

export function CareStackEnhancedDashboard({ officeId }: CareStackEnhancedDashboardProps) {
  const [modifiedSince, setModifiedSince] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  )
  const [appointmentId, setAppointmentId] = useState('')
  const [procedureCode, setProcedureCode] = useState('')

  const { syncPatients, syncAppointments, syncTreatments, isLoading: isSyncing } = useCareStackSync()
  const { performAppointmentAction, appointmentStatuses, isLoading: isAppointmentLoading } = useCareStackAppointments()
  const { getProcedureCodes, getProductionTypes, getAppointmentProcedures } = useCareStackProcedures()

  const procedureCodesQuery = getProcedureCodes({ 
    officeId, 
    code: procedureCode || undefined,
    limit: 10 
  })
  const productionTypesQuery = getProductionTypes(officeId)
  const appointmentProceduresQuery = getAppointmentProcedures({ 
    officeId, 
    appointmentId: appointmentId || '1' 
  })

  const handleSync = (type: 'patients' | 'appointments' | 'treatments') => {
    const params = {
      officeId,
      modifiedSince: modifiedSince + 'T00:00:00Z'
    }

    switch (type) {
      case 'patients':
        syncPatients(params)
        break
      case 'appointments':
        syncAppointments(params)
        break
      case 'treatments':
        syncTreatments({ ...params, includeDeleted: false })
        break
    }
  }

  const handleAppointmentAction = (action: string) => {
    if (!appointmentId) return

    const actionData = action === 'modify-status' ? {
      status: 'confirmed',
      notes: 'Status updated via dashboard'
    } : undefined

    performAppointmentAction({
      officeId,
      appointmentId,
      action: action as any,
      data: actionData
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2">
        <FileText className="h-5 w-5" />
        <h2 className="text-2xl font-bold">CareStack Enhanced Integration</h2>
        <Badge variant="secondary">Phase 2 Complete</Badge>
      </div>

      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="sync">Data Sync</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="procedures">Procedures</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <RotateCcw className="h-5 w-5" />
                <span>Data Synchronization</span>
              </CardTitle>
              <CardDescription>
                Sync patients, appointments, and treatments from CareStack
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="modifiedSince">Modified Since</Label>
                  <Input
                    id="modifiedSince"
                    type="date"
                    value={modifiedSince}
                    onChange={(e) => setModifiedSince(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <Button
                  onClick={() => handleSync('patients')}
                  disabled={isSyncing}
                  className="flex items-center space-x-2"
                >
                  <Users className="h-4 w-4" />
                  <span>Sync Patients</span>
                  {isSyncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </Button>

                <Button
                  onClick={() => handleSync('appointments')}
                  disabled={isSyncing}
                  className="flex items-center space-x-2"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Sync Appointments</span>
                  {isSyncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </Button>

                <Button
                  onClick={() => handleSync('treatments')}
                  disabled={isSyncing}
                  className="flex items-center space-x-2"
                >
                  <FileText className="h-4 w-4" />
                  <span>Sync Treatments</span>
                  {isSyncing && <RefreshCw className="h-4 w-4 animate-spin" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Appointment Management</span>
              </CardTitle>
              <CardDescription>
                Manage appointments with enhanced CareStack integration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentId">Appointment ID</Label>
                  <Input
                    id="appointmentId"
                    placeholder="Enter appointment ID"
                    value={appointmentId}
                    onChange={(e) => setAppointmentId(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => handleAppointmentAction('get')}
                  disabled={!appointmentId || isAppointmentLoading}
                  variant="outline"
                >
                  Get Details
                </Button>

                <Button
                  onClick={() => handleAppointmentAction('cancel')}
                  disabled={!appointmentId || isAppointmentLoading}
                  variant="destructive"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>

                <Button
                  onClick={() => handleAppointmentAction('checkout')}
                  disabled={!appointmentId || isAppointmentLoading}
                  variant="default"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Checkout
                </Button>

                <Button
                  onClick={() => handleAppointmentAction('modify-status')}
                  disabled={!appointmentId || isAppointmentLoading}
                  variant="secondary"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Confirm
                </Button>
              </div>

              {appointmentStatuses && (
                <div className="space-y-2">
                  <Label>Available Statuses</Label>
                  <div className="flex flex-wrap gap-2">
                    {appointmentStatuses.map((status: any) => (
                      <Badge key={status.id} variant="outline">
                        {status.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procedures" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Procedures & Treatments</span>
              </CardTitle>
              <CardDescription>
                Browse procedure codes and production types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="procedureCode">Search Procedure Code</Label>
                  <Input
                    id="procedureCode"
                    placeholder="e.g., D0150"
                    value={procedureCode}
                    onChange={(e) => setProcedureCode(e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Procedure Codes</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {procedureCodesQuery.data?.map((procedure: any) => (
                      <div key={procedure.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{procedure.code}</div>
                        <div className="text-muted-foreground">{procedure.description}</div>
                        {procedure.fee && (
                          <div className="text-green-600">${procedure.fee}</div>
                        )}
                      </div>
                    ))}
                    {procedureCodesQuery.isLoading && (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading procedures...</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Production Types</Label>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {productionTypesQuery.data?.map((type: any) => (
                      <div key={type.id} className="p-2 border rounded text-sm">
                        <div className="font-medium">{type.name}</div>
                        {type.description && (
                          <div className="text-muted-foreground">{type.description}</div>
                        )}
                        <Badge variant={type.isActive ? "default" : "secondary"}>
                          {type.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    ))}
                    {productionTypesQuery.isLoading && (
                      <div className="flex items-center space-x-2">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Loading production types...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {appointmentId && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Appointment Procedures (ID: {appointmentId})</Label>
                    <div className="flex flex-wrap gap-2">
                      {appointmentProceduresQuery.data?.map((procId: number) => (
                        <Badge key={procId} variant="outline">
                          Procedure {procId}
                        </Badge>
                      ))}
                      {appointmentProceduresQuery.isLoading && (
                        <div className="flex items-center space-x-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integration Status</CardTitle>
              <CardDescription>
                Current status of CareStack Phase 2 enhancements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">Implemented Features</h4>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Patient Data Sync</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Appointment Sync</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Treatment Procedures Sync</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Appointment Management</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Procedure Codes API</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span>Production Types API</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium">API Endpoints</h4>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>/api/v1.0/sync/patients</li>
                    <li>/api/v1.0/sync/appointments</li>
                    <li>/api/v1.0/sync/treatment-procedures</li>
                    <li>/api/v1.0/appointments/{`{id}`}/cancel</li>
                    <li>/api/v1.0/appointments/{`{id}`}/checkout</li>
                    <li>/api/v1.0/procedure-codes</li>
                    <li>/api/v1.0/production-types</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}