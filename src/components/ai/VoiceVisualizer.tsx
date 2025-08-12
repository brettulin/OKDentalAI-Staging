import React from 'react';
import { cn } from '@/lib/utils';

interface VoiceVisualizerProps {
  isRecording: boolean;
  isPlaying: boolean;
  audioLevel: number;
  className?: string;
}

export function VoiceVisualizer({ isRecording, isPlaying, audioLevel, className }: VoiceVisualizerProps) {
  // Generate bars for visualizer
  const bars = Array.from({ length: 5 }, (_, i) => {
    let height = 'h-2';
    
    if (isRecording) {
      // Scale based on audio level
      const scaledLevel = Math.min(audioLevel / 50, 1); // Normalize to 0-1
      const barHeight = Math.max(0.2, scaledLevel * (1 + i * 0.2)); // Different heights per bar
      
      if (barHeight > 0.8) height = 'h-8';
      else if (barHeight > 0.6) height = 'h-6';
      else if (barHeight > 0.4) height = 'h-4';
      else if (barHeight > 0.2) height = 'h-3';
      else height = 'h-2';
    } else if (isPlaying) {
      // Animated bars for playback
      height = 'h-4';
    }
    
    return height;
  });

  if (!isRecording && !isPlaying) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-1 justify-center", className)}>
      {bars.map((height, i) => (
        <div
          key={i}
          className={cn(
            "w-1 bg-current rounded-full transition-all duration-150",
            height,
            isRecording && "bg-destructive",
            isPlaying && "bg-primary animate-pulse",
            isPlaying && `animation-delay-${i * 100}`
          )}
          style={{
            animationDelay: isPlaying ? `${i * 100}ms` : undefined
          }}
        />
      ))}
    </div>
  );
}