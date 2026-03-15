# Rest Timer Rework — Stopwatch Spec

## Overview
Replace the rest timer countdown with an upward-counting stopwatch.
The timer is displayed inside the workout sheet (RestTimer component).

## States

| State   | Display        | Buttons                         |
|---------|----------------|---------------------------------|
| idle    | `0.00`         | [▶ Play]                        |
| running | `MM:SS.cs`     | [⏸ Pause]                       |
| paused  | `MM:SS.cs`     | [▶ Continue]  [↺ Reset]         |

Reset is in the same horizontal position as Pause was.

## Display Format
- Under 1 minute: `S.cs` or `SS.cs` (e.g. `0.00`, `9.73`, `59.99`)
- 1 minute and over: `M:SS.cs` (e.g. `1:00.00`, `12:34.56`)
- Always shows centiseconds (2 decimal places).

## Timer Accuracy
- Use `Date.now()` (wall-clock milliseconds) to compute elapsed time on each render.
- Never accumulate state by subtracting 1s per tick.
- Interval fires every 50ms to drive re-renders (fast enough for smooth centisecond display).

## State Transitions
```
idle ──[Play]──▶ running
running ──[Pause]──▶ paused
paused ──[Continue]──▶ running
paused ──[Reset]──▶ idle
```

## Removed Features
- Configurable countdown duration
- +30s adjustment button
- Timer completion haptic feedback
- Flash-on-complete animation

## Data Model
```typescript
export type RestTimerStatus = 'idle' | 'running' | 'paused';

export interface RestTimerState {
  status: RestTimerStatus;
  elapsedMs: number;      // accumulated ms from completed segments
  startTime: number | null; // Date.now() when current segment started
}
```

## Context API
```typescript
restTimer: RestTimerState
startRestTimer(): void     // idle → running
pauseRestTimer(): void     // running → paused
resumeRestTimer(): void    // paused → running
resetRestTimer(): void     // paused → idle
```
