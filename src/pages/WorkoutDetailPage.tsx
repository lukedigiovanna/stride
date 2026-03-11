// Placeholder — implemented in Step 9
import { useParams } from 'react-router-dom';

export default function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
      <span className="text-4xl">💪</span>
      <p className="text-sm">Workout {id}</p>
    </div>
  );
}
