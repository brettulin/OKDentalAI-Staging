import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square, Volume2, VolumeX } from 'lucide-react';
import { VoiceVisualizer } from './VoiceVisualizer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface VoiceControlsProps {
  isRecording: boolean;
  isPlaying: boolean;
  isProcessing: boolean;
  canInterrupt: boolean;
  audioLevel: number;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInterrupt: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceControls({
  isRecording,
  isPlaying,
  isProcessing,
  canInterrupt,
  audioLevel,
  onStartRecording,
  onStopRecording,
  onInterrupt,
  disabled = false,
  className
}: VoiceControlsProps) {
  const handleRecordingClick = () => {
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Recording Button */}
      <div className="relative">
        <Button 
          onClick={handleRecordingClick}
          disabled={disabled || isProcessing}
          variant={isRecording ? "destructive" : "outline"}
          size="sm"
          className={cn(
            "relative overflow-hidden transition-all duration-200",
            isRecording && "animate-pulse shadow-lg shadow-destructive/20",
            !isRecording && !isPlaying && "hover:shadow-md"
          )}
        >
          {isRecording ? (
            <MicOff className="w-4 h-4" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
          
          {/* Recording indicator overlay */}
          {isRecording && (
            <div className="absolute inset-0 bg-destructive/20 animate-pulse" />
          )}
        </Button>
        
        {/* Recording status badge */}
        {isRecording && (
          <Badge 
            variant="destructive" 
            className="absolute -top-2 -right-2 px-1 py-0 text-xs animate-pulse"
          >
            REC
          </Badge>
        )}
      </div>

      {/* Voice Visualizer */}
      <VoiceVisualizer 
        isRecording={isRecording}
        isPlaying={isPlaying}
        audioLevel={audioLevel}
        className="min-w-[60px]"
      />

      {/* Interrupt Button */}
      {canInterrupt && (
        <Button 
          onClick={onInterrupt}
          variant="outline"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Square className="w-3 h-3 mr-1" />
          Stop
        </Button>
      )}

      {/* Status Indicators */}
      <div className="flex items-center gap-1">
        {isPlaying && (
          <div className="flex items-center gap-1 text-primary">
            <Volume2 className="w-3 h-3" />
            <span className="text-xs">Playing</span>
          </div>
        )}
        
        {isProcessing && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Processing</span>
          </div>
        )}
      </div>
    </div>
  );
}