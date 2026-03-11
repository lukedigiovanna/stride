// Placeholder — implemented in Step 8
import { useParams } from 'react-router-dom';

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
      <span className="text-4xl">📊</span>
      <p className="text-sm">Exercise {id}</p>
    </div>
  );
}
