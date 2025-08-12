import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, CheckCircle, MapPin, Stethoscope } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'

interface CareStackLocation {
  id: string
  name: string
  address: {
    street: string
    city: string
    state: string
    zipCode: string
  }
  phone: string | null
}

interface CareStackOperatory {
  id: string
  name: string
  locationId: string
  isActive: boolean
  equipmentList?: string[]
}

export function CareStackSetup() {
  const { user } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedOffice, setSelectedOffice] = useState<string>('')
  const [selectedLocation, setSelectedLocation] = useState<string>('')
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [locations, setLocations] = useState<CareStackLocation[]>([])
  const [operatories, setOperatories] = useState<CareStackOperatory[]>([])

  // Check if mock mode is enabled
  const isMockMode = true // This would come from environment or settings

  // Fetch CareStack offices
  const { data: offices, isLoading: officesLoading } = useQuery({
    queryKey: ['carestack-offices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offices')
        .select('*')
        .eq('pms_type', 'carestack')
      
      if (error) throw error
      return data || []
    }
  })

  // Test CareStack connection
  const testConnectionMutation = useMutation({
    mutationFn: async (officeId: string) => {
      const { data, error } = await supabase.functions.invoke('pms-carestack-list-locations', {
        body: { officeId }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setLocations(data.locations || [])
      toast({
        title: "Connection successful!",
        description: `Found ${data.locations?.length || 0} locations in CareStack`,
      })
    },
    onError: (error: any) => {
      console.error('Connection test failed:', error)
      toast({
        title: "Connection failed",
        description: error.message || "Unable to connect to CareStack",
        variant: "destructive",
      })
    }
  })

  // Fetch operatories for selected location
  const fetchOperatoriesMutation = useMutation({
    mutationFn: async ({ officeId, locationId }: { officeId: string; locationId: string }) => {
      const { data, error } = await supabase.functions.invoke('pms-carestack-list-operatories', {
        body: { officeId, locationId }
      })
      
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setOperatories(data.operatories || [])
    },
    onError: (error: any) => {
      console.error('Failed to fetch operatories:', error)
      toast({
        title: "Failed to fetch operatories",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  const handleTestConnection = async () => {
    if (!selectedOffice) {
      toast({
        title: "Select an office",
        description: "Please select a CareStack office to test",
        variant: "destructive",
      })
      return
    }

    setIsTestingConnection(true)
    try {
      await testConnectionMutation.mutateAsync(selectedOffice)
    } finally {
      setIsTestingConnection(false)
    }
  }

  const handleLocationChange = async (locationId: string) => {
    setSelectedLocation(locationId)
    setOperatories([])
    
    if (selectedOffice && locationId) {
      await fetchOperatoriesMutation.mutateAsync({
        officeId: selectedOffice,
        locationId
      })
    }
  }

  if (officesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading CareStack configuration...</span>
      </div>
    )
  }

  if (!offices || offices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            CareStack Integration
          </CardTitle>
          <CardDescription>
            No CareStack offices configured. Please set up a CareStack office in PMS Settings first.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Mock Mode Banner */}
      {isMockMode && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Mock Mode Active:</strong> CareStack integration is running in mock mode with simulated data. 
            Real API calls are disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Connection Test */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            CareStack Connection Test
          </CardTitle>
          <CardDescription>
            Test your CareStack integration and view available locations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="office-select">Select CareStack Office</Label>
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an office..." />
              </SelectTrigger>
              <SelectContent>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={handleTestConnection}
            disabled={!selectedOffice || isTestingConnection}
            className="w-full"
          >
            {isTestingConnection ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Test CareStack Connection
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Locations */}
      {locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Available Locations
            </CardTitle>
            <CardDescription>
              Locations found in your CareStack system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {locations.map((location) => (
                <Card key={location.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{location.name}</h4>
                      <Badge variant="outline">{location.id}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>{location.address.street}</p>
                      <p>{location.address.city}, {location.address.state} {location.address.zipCode}</p>
                      {location.phone && <p>📞 {location.phone}</p>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLocationChange(location.id)}
                      className="w-full mt-2"
                    >
                      View Operatories
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Operatories */}
      {selectedLocation && operatories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Operatories</CardTitle>
            <CardDescription>
              Operatories available at the selected location
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              {operatories.map((operatory) => (
                <Card key={operatory.id} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{operatory.name}</h5>
                      <Badge variant={operatory.isActive ? "default" : "secondary"}>
                        {operatory.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">ID: {operatory.id}</p>
                    {operatory.equipmentList && operatory.equipmentList.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1">Equipment:</p>
                        <div className="flex flex-wrap gap-1">
                          {operatory.equipmentList.map((equipment, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {equipment}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Summary */}
      {selectedOffice && locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Integration Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Office:</span>
              <span className="text-sm font-medium">
                {offices.find(o => o.id === selectedOffice)?.name}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Locations:</span>
              <span className="text-sm font-medium">{locations.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Operatories:</span>
              <span className="text-sm font-medium">
                {locations.reduce((sum, loc) => sum + (loc as any).operatories?.length || 0, 0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Status:</span>
              <Badge variant="default" className="text-xs">
                {isMockMode ? "Mock Mode" : "Live"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}