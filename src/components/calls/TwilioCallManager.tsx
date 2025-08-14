import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Phone, PhoneOff, MessageSquare, RefreshCw } from 'lucide-react';
import { useTwilioIntegration } from '@/hooks/useTwilioIntegration';
import { useRealtimeCallMonitoring } from '@/hooks/useRealtimeCallMonitoring';

const TwilioCallManager: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [smsNumber, setSmsNumber] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  
  const {
    makeCall,
    hangupCall,
    sendSMS,
    phoneNumbers,
    loadingNumbers,
    isCallingInProgress,
    isHangingUp,
    isSendingSMS
  } = useTwilioIntegration();

  const { activeCalls, updateCallStatus } = useRealtimeCallMonitoring();

  const handleMakeCall = () => {
    if (phoneNumber.trim()) {
      makeCall({ to: phoneNumber.trim() });
      setPhoneNumber('');
    }
  };

  const handleHangupCall = (callSid: string) => {
    hangupCall(callSid);
  };

  const handleSendSMS = () => {
    if (smsNumber.trim() && smsMessage.trim()) {
      sendSMS({ to: smsNumber.trim(), body: smsMessage.trim() });
      setSmsNumber('');
      setSmsMessage('');
    }
  };

  const formatPhoneNumber = (number: string) => {
    return number.replace(/^\+1/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  };

  return (
    <div className="space-y-6">
      {/* Phone Numbers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Twilio Phone Numbers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingNumbers ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading phone numbers...
            </div>
          ) : phoneNumbers?.length > 0 ? (
            <div className="space-y-2">
              {phoneNumbers.map((number: any) => (
                <div key={number.sid} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{formatPhoneNumber(number.phone_number)}</p>
                    <p className="text-sm text-muted-foreground">{number.friendly_name}</p>
                  </div>
                  <Badge variant={number.status === 'in-use' ? 'default' : 'secondary'}>
                    {number.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No phone numbers configured</p>
          )}
        </CardContent>
      </Card>

      {/* Make Call */}
      <Card>
        <CardHeader>
          <CardTitle>Make Outbound Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Enter phone number (e.g., +1234567890)"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleMakeCall} 
              disabled={!phoneNumber.trim() || isCallingInProgress}
              className="flex items-center gap-2"
            >
              {isCallingInProgress ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              Call
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Calls */}
      {activeCalls.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{formatPhoneNumber(call.caller_phone || 'Unknown')}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="default">{call.status}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {call.started_at && new Date(call.started_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  {call.twilio_call_sid && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleHangupCall(call.twilio_call_sid!)}
                      disabled={isHangingUp}
                      className="flex items-center gap-2"
                    >
                      <PhoneOff className="h-4 w-4" />
                      End Call
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Send SMS */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Send SMS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Enter phone number (e.g., +1234567890)"
            value={smsNumber}
            onChange={(e) => setSmsNumber(e.target.value)}
          />
          <Textarea
            placeholder="Enter your message..."
            value={smsMessage}
            onChange={(e) => setSmsMessage(e.target.value)}
            rows={3}
          />
          <Button 
            onClick={handleSendSMS} 
            disabled={!smsNumber.trim() || !smsMessage.trim() || isSendingSMS}
            className="flex items-center gap-2"
          >
            {isSendingSMS ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            Send SMS
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TwilioCallManager;