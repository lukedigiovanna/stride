import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useExercises } from '@/hooks/useExercises';
import ExerciseList from '@/components/exercises/ExerciseList';
import CreateExerciseModal from '@/components/exercises/CreateExerciseModal';
import type { UserExerciseProgress } from '@/types';

export default function ExercisesPage() {
  const { user } = useAuth();
  const { exercises, isLoading } = useExercises();
  const [progressMap, setProgressMap] = useState<Record<string, UserExerciseProgress>>({});
  const [createOpen, setCreateOpen] = useState(false);

  // Load all progress rows for this user in one query
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_exercise_progress')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data }) => {
        const map: Record<string, UserExerciseProgress> = {};
        for (const row of (data ?? []) as UserExerciseProgress[]) {
          map[row.exercise_id] = row;
        }
        setProgressMap(map);
      });
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading exercises…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <ExerciseList
        exercises={exercises}
        progressMap={progressMap}
        currentUserId={user?.id ?? ''}
      />

      {/* FAB */}
      <button
        onClick={() => setCreateOpen(true)}
        className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-lg active:opacity-90 transition-opacity"
      >
        <Plus className="h-4 w-4" />
        New Exercise
      </button>

      <CreateExerciseModal open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
