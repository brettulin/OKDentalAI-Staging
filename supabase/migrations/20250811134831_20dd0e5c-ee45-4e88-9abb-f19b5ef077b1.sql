-- Add INSERT policy to clinics table to allow authenticated users to create clinics
CREATE POLICY "Users can create clinics" 
ON public.clinics 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Add UPDATE policy to clinics table so users can modify their clinic details
CREATE POLICY "Users can update their clinic" 
ON public.clinics 
FOR UPDATE 
TO authenticated 
USING (id IN ( SELECT profiles.clinic_id FROM profiles WHERE profiles.user_id = auth.uid()))
WITH CHECK (id IN ( SELECT profiles.clinic_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Add DELETE policy to clinics table
CREATE POLICY "Users can delete their clinic" 
ON public.clinics 
FOR DELETE 
TO authenticated 
USING (id IN ( SELECT profiles.clinic_id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Add INSERT policy to profiles table so users can create/update their profile
CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());