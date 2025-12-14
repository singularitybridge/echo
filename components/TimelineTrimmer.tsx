/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Scissors, SkipForward } from 'lucide-react';

interface TimelineTrimmerProps {
  duration: number; // Total video duration in seconds
  startTrim: number; // Start trim point in seconds
  endTrim: number; // End trim point in seconds
  currentTime: number; // Current playback position in seconds
  onTrimChange: (startTrim: number, endTrim: number) => void;
  onSeek: (time: number) => void; // Callback to seek video playback
  onPause?: () => void; // Callback to pause video during drag
  disabled?: boolean;
}

const MIN_DURATION = 0.5; // Minimum trimmed duration in seconds

export function TimelineTrimmer({
  duration,
  startTrim,
  endTrim,
  currentTime,
  onTrimChange,
  onSeek,
  onPause,
  disabled = false,
}: TimelineTrimmerProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);

  // Convert time to pixel position
  const timeToPosition = (time: number): number => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.offsetWidth;
    return (time / duration) * width;
  };

  // Convert pixel position to time
  const positionToTime = (position: number): number => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.offsetWidth;
    const time = (position / width) * duration;
    return Math.max(0, Math.min(duration, time));
  };

  // Handle mouse/touch move for dragging
  const handleDrag = (clientX: number) => {
    if (!timelineRef.current || (!isDraggingStart && !isDraggingEnd)) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const position = clientX - rect.left;
    const time = positionToTime(position);

    if (isDraggingStart) {
      // Ensure start doesn't exceed end - MIN_DURATION
      const newStart = Math.max(0, Math.min(time, endTrim - MIN_DURATION));
      onTrimChange(newStart, endTrim);
      // Seek video to show preview of start frame
      onSeek(newStart);
    } else if (isDraggingEnd) {
      // Ensure end doesn't go below start + MIN_DURATION
      const newEnd = Math.max(startTrim + MIN_DURATION, Math.min(time, duration));
      onTrimChange(startTrim, newEnd);
      // Seek video to show preview of end frame
      onSeek(newEnd);
    }
  };

  // Mouse event handlers
  useEffect(() => {
    if (!isDraggingStart && !isDraggingEnd) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDrag(e.clientX);
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd, startTrim, endTrim, duration]);

  // Handle timeline click to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled || isDraggingStart || isDraggingEnd) return;
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const position = e.clientX - rect.left;
    const time = positionToTime(position);
    onSeek(time);
  };

  // Set In/Out point buttons
  const handleSetInPoint = () => {
    if (disabled) return;
    const newStart = Math.max(0, Math.min(currentTime, endTrim - MIN_DURATION));
    onTrimChange(newStart, endTrim);
  };

  const handleSetOutPoint = () => {
    if (disabled) return;
    const newEnd = Math.max(startTrim + MIN_DURATION, Math.min(currentTime, duration));
    onTrimChange(startTrim, newEnd);
  };

  // Format time as "0.0s"
  const formatTime = (time: number): string => {
    return `${time.toFixed(1)}s`;
  };

  // Calculate positions as percentages
  const startPercent = (startTrim / duration) * 100;
  const endPercent = (endTrim / duration) * 100;
  const currentPercent = (currentTime / duration) * 100;

  return (
    <div className="space-y-3">
      {/* Control Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleSetInPoint}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Set In Point (I)"
        >
          <SkipForward className="w-4 h-4 rotate-180" />
          <span>Set In Point</span>
        </button>
        <button
          onClick={handleSetOutPoint}
          disabled={disabled}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Set Out Point (O)"
        >
          <span>Set Out Point</span>
          <SkipForward className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <div className="text-sm text-gray-600">
          Duration: {formatTime(endTrim - startTrim)}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        {/* Time Labels */}
        <div className="flex justify-between text-xs text-gray-500 px-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((sec) => (
            <div key={sec} className="w-0 flex justify-center">
              {sec}s
            </div>
          ))}
        </div>

        {/* Timeline Track */}
        <div
          ref={timelineRef}
          className={`relative h-12 bg-gray-100 rounded cursor-pointer select-none ${
            disabled ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          onClick={handleTimelineClick}
        >
          {/* Trimmed regions (dimmed) */}
          {startTrim > 0 && (
            <div
              className="absolute top-0 bottom-0 left-0 bg-gray-200 opacity-50"
              style={{ width: `${startPercent}%` }}
            />
          )}
          {endTrim < duration && (
            <div
              className="absolute top-0 bottom-0 right-0 bg-gray-200 opacity-50"
              style={{ width: `${100 - endPercent}%` }}
            />
          )}

          {/* Active region (highlighted) */}
          <div
            className="absolute top-0 bottom-0 bg-indigo-100"
            style={{
              left: `${startPercent}%`,
              width: `${endPercent - startPercent}%`,
            }}
          />

          {/* Playhead */}
          {currentTime >= 0 && currentTime <= duration && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-red-600 z-20 pointer-events-none shadow-lg"
              style={{ left: `${currentPercent}%` }}
            >
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-600 rounded-full shadow-md border border-white" />
            </div>
          )}

          {/* Start Handle */}
          <div
            className={`absolute top-0 bottom-0 w-5 -ml-2.5 flex items-center justify-center cursor-ew-resize z-10 ${
              isDraggingStart ? 'bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
            style={{ left: `${startPercent}%` }}
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              onPause?.(); // Pause video for clear preview
              setIsDraggingStart(true);
            }}
            title={`Start: ${formatTime(startTrim)}`}
          >
            <Scissors className="w-3 h-3 text-white" />
          </div>

          {/* End Handle */}
          <div
            className={`absolute top-0 bottom-0 w-5 -mr-2.5 flex items-center justify-center cursor-ew-resize z-10 ${
              isDraggingEnd ? 'bg-indigo-500' : 'bg-indigo-600 hover:bg-indigo-700'
            } ${disabled ? 'cursor-not-allowed' : ''}`}
            style={{ left: `${endPercent}%` }}
            onMouseDown={(e) => {
              if (disabled) return;
              e.preventDefault();
              e.stopPropagation();
              onPause?.(); // Pause video for clear preview
              setIsDraggingEnd(true);
            }}
            title={`End: ${formatTime(endTrim)}`}
          >
            <Scissors className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Trim Info */}
        <div className="flex justify-between text-xs text-gray-600 px-1">
          <div>In: {formatTime(startTrim)}</div>
          <div>Out: {formatTime(endTrim)}</div>
        </div>
      </div>
    </div>
  );
}
