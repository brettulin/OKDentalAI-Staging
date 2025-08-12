import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePatientWorkflow, PatientSearchResult, AppointmentSlot } from '@/hooks/usePatientWorkflow';
import { Search, Plus, Calendar as CalendarIcon, Clock, User, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface PatientLookupProps {
  officeId: string;
  onPatientSelected?: (patient: PatientSearchResult) => void;
  onAppointmentBooked?: (appointmentData: any) => void;
}

export function PatientLookup({ officeId, onPatientSelected, onAppointmentBooked }: PatientLookupProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [availableSlots, setAvailableSlots] = useState<AppointmentSlot[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
  const [newPatientForm, setNewPatientForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    dateOfBirth: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    }
  });

  const {
    selectedPatient,
    selectedSlot,
    setSelectedPatient,
    setSelectedSlot,
    providers,
    locations,
    searchPatients,
    createPatient,
    getAvailableSlotsForDate,
    bookAppointment,
    isSearching,
    isCreatingPatient,
    isGettingSlots,
    isBooking,
    providersLoading,
    locationsLoading,
    formatPhoneNumber
  } = usePatientWorkflow(officeId);

  const handleSearch = async () => {
    if (!phoneNumber.trim()) return;
    
    try {
      const results = await searchPatients(phoneNumber);
      setSearchResults(results);
      
      if (results.length === 0) {
        setShowCreateForm(true);
        setNewPatientForm(prev => ({ ...prev, phone: phoneNumber }));
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSelectPatient = (patient: PatientSearchResult) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setShowCreateForm(false);
    setShowBooking(true);
    onPatientSelected?.(patient);
  };

  const handleCreatePatient = async () => {
    try {
      const patient = await createPatient({
        ...newPatientForm,
        phone: phoneNumber
      });
      
      handleSelectPatient(patient);
    } catch (error) {
      console.error('Create patient error:', error);
    }
  };

  const handleDateSelect = async (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    
    if (date && selectedProvider) {
      try {
        const slots = await getAvailableSlotsForDate(selectedProvider, date.toISOString());
        setAvailableSlots(slots);
      } catch (error) {
        console.error('Get slots error:', error);
        setAvailableSlots([]);
      }
    }
  };

  const handleProviderChange = async (providerId: string) => {
    setSelectedProvider(providerId);
    setSelectedSlot(null);
    
    if (selectedDate) {
      try {
        const slots = await getAvailableSlotsForDate(providerId, selectedDate.toISOString());
        setAvailableSlots(slots);
      } catch (error) {
        console.error('Get slots error:', error);
        setAvailableSlots([]);
      }
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedPatient || !selectedSlot || !selectedLocation) return;
    
    try {
      const appointment = await bookAppointment({
        patientId: selectedPatient.id,
        providerId: selectedSlot.providerId,
        locationId: selectedLocation,
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        notes: 'Booked via AI Receptionist'
      });
      
      onAppointmentBooked?.(appointment);
      
      // Reset form
      setPhoneNumber('');
      setSelectedPatient(null);
      setSelectedSlot(null);
      setShowBooking(false);
      setSelectedDate(undefined);
      setAvailableSlots([]);
      setSelectedProvider('');
      setSelectedLocation('');
    } catch (error) {
      console.error('Book appointment error:', error);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Patient Lookup & Booking
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Patient Search */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="phone">Patient Phone Number</Label>
              <Input
                id="phone"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="(555) 123-4567"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={isSearching || !phoneNumber.trim()}
              className="mt-6"
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label>Found Patients:</Label>
              {searchResults.map((patient) => (
                <Card key={patient.id} className="p-3 hover:bg-muted cursor-pointer" onClick={() => handleSelectPatient(patient)}>
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-medium">{patient.firstName} {patient.lastName}</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatPhoneNumber(patient.phone)} • {patient.email}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">Select</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Create New Patient Form */}
          {showCreateForm && (
            <Card className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <h3 className="font-medium">Create New Patient</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={newPatientForm.firstName}
                      onChange={(e) => setNewPatientForm(prev => ({ ...prev, firstName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={newPatientForm.lastName}
                      onChange={(e) => setNewPatientForm(prev => ({ ...prev, lastName: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newPatientForm.email}
                      onChange={(e) => setNewPatientForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={newPatientForm.dateOfBirth}
                      onChange={(e) => setNewPatientForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreatePatient}
                    disabled={isCreatingPatient || !newPatientForm.firstName || !newPatientForm.lastName}
                  >
                    {isCreatingPatient ? 'Creating...' : 'Create Patient'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Selected Patient & Booking */}
        {selectedPatient && showBooking && (
          <>
            <Separator />
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Selected Patient</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedPatient.firstName} {selectedPatient.lastName} • {formatPhoneNumber(selectedPatient.phone)}
                  </p>
                </div>
                <Badge variant="secondary">Selected</Badge>
              </div>

              {/* Booking Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Provider & Location Selection */}
                <div className="space-y-4">
                  <div>
                    <Label>Select Provider</Label>
                    <Select value={selectedProvider} onValueChange={handleProviderChange} disabled={providersLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={providersLoading ? "Loading..." : "Choose provider"} />
                      </SelectTrigger>
                      <SelectContent>
                        {providers?.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name} - {provider.specialty}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Select Location</Label>
                    <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={locationsLoading}>
                      <SelectTrigger>
                        <SelectValue placeholder={locationsLoading ? "Loading..." : "Choose location"} />
                      </SelectTrigger>
                      <SelectContent>
                        {locations?.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              {location.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date & Time Selection */}
                <div className="space-y-4">
                  <div>
                    <Label>Select Date</Label>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date < new Date() || !selectedProvider}
                      className="rounded-md border"
                    />
                  </div>
                </div>
              </div>

              {/* Available Slots */}
              {availableSlots.length > 0 && (
                <div className="space-y-2">
                  <Label>Available Times</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <Button
                        key={slot.id}
                        variant={selectedSlot?.id === slot.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSlot(slot)}
                        disabled={!slot.available}
                        className="flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {format(new Date(slot.startTime), 'h:mm a')}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Book Appointment Button */}
              {selectedSlot && selectedLocation && (
                <Button
                  onClick={handleBookAppointment}
                  disabled={isBooking}
                  className="w-full"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {isBooking ? 'Booking...' : 'Book Appointment'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}