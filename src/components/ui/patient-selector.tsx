import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, User, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedSearch } from "@/hooks/useDebouncedSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface Patient {
  id: string;
  full_name: string;
  phone: string;
  email?: string;
}

interface PatientSelectorProps {
  selectedPatient: Patient | null;
  onPatientSelect: (patient: Patient | null) => void;
  onCreateNew: (patientData: { name: string; phone: string; email?: string }) => void;
}

export function PatientSelector({ selectedPatient, onPatientSelect, onCreateNew }: PatientSelectorProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { searchTerm, setSearchTerm, debouncedValue } = useDebouncedSearch();
  const [newPatientData, setNewPatientData] = useState({
    name: '',
    phone: '',
    email: ''
  });

  // Search patients
  const { data: patients, isLoading } = useQuery({
    queryKey: ['patients-search', profile?.clinic_id, debouncedValue],
    queryFn: async () => {
      if (!profile?.clinic_id || !debouncedValue.trim()) return [];

      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, phone, email')
        .eq('clinic_id', profile.clinic_id)
        .or(`full_name.ilike.%${debouncedValue}%,phone.ilike.%${debouncedValue}%,email.ilike.%${debouncedValue}%`)
        .order('full_name')
        .limit(10);

      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!profile?.clinic_id && debouncedValue.length > 0,
  });

  const handleSelectPatient = (patient: Patient) => {
    onPatientSelect(patient);
    setOpen(false);
    setShowCreateForm(false);
  };

  const handleCreateNew = () => {
    if (!newPatientData.name.trim() || !newPatientData.phone.trim()) return;
    
    onCreateNew(newPatientData);
    setNewPatientData({ name: '', phone: '', email: '' });
    setShowCreateForm(false);
    setOpen(false);
  };

  const handleShowCreateForm = () => {
    // Pre-fill with search term if it looks like a name
    if (searchTerm && !searchTerm.includes('@') && !searchTerm.match(/^\d/)) {
      setNewPatientData(prev => ({ ...prev, name: searchTerm }));
    }
    setShowCreateForm(true);
  };

  return (
    <div className="space-y-2">
      <Label>Patient *</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedPatient ? (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{selectedPatient.full_name}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{selectedPatient.phone}</span>
              </div>
            ) : (
              <span className="text-muted-foreground">Search or create patient...</span>
            )}
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          {!showCreateForm ? (
            <Command>
              <CommandInput
                placeholder="Search patients by name, phone, or email..."
                value={searchTerm}
                onValueChange={setSearchTerm}
              />
              <CommandList>
                <CommandEmpty>
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      {debouncedValue ? 'No patients found' : 'Start typing to search...'}
                    </p>
                    {debouncedValue && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShowCreateForm}
                        className="gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Create new patient
                      </Button>
                    )}
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {patients?.map((patient) => (
                    <CommandItem
                      key={patient.id}
                      value={patient.id}
                      onSelect={() => handleSelectPatient(patient)}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <User className="h-4 w-4" />
                      <div className="flex-1">
                        <div className="font-medium">{patient.full_name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {patient.phone}
                          {patient.email && (
                            <>
                              <span>•</span>
                              <span>{patient.email}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {debouncedValue && patients && patients.length > 0 && (
                  <CommandGroup>
                    <CommandItem onSelect={handleShowCreateForm} className="cursor-pointer">
                      <Plus className="h-4 w-4 mr-2" />
                      Create new patient
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          ) : (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Create New Patient</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateForm(false)}
                >
                  Back to search
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="new-name">Full Name *</Label>
                  <Input
                    id="new-name"
                    value={newPatientData.name}
                    onChange={(e) => setNewPatientData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter patient name"
                  />
                </div>
                <div>
                  <Label htmlFor="new-phone">Phone Number *</Label>
                  <Input
                    id="new-phone"
                    value={newPatientData.phone}
                    onChange={(e) => setNewPatientData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <Label htmlFor="new-email">Email (Optional)</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newPatientData.email}
                    onChange={(e) => setNewPatientData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="patient@example.com"
                  />
                </div>
                <Button
                  onClick={handleCreateNew}
                  disabled={!newPatientData.name.trim() || !newPatientData.phone.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Patient
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}