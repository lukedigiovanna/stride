import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getGamificationState } from '@/lib/xp';
import XPBar from '@/components/shared/XPBar';
import type { Profile } from '@/types';

interface RankCardProps {
  profile: Profile;
}

export default function RankCard({ profile }: RankCardProps) {
  const { updateProfile } = useAuth();
  const gam = getGamificationState(profile.total_xp);

  const [isEditing, setIsEditing] = useState(false);
  const [nameVal, setNameVal] = useState(profile.display_name ?? '');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveName() {
    const trimmed = nameVal.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: trimmed })
        .eq('id', profile.id);
      if (error) throw error;
      updateProfile({ display_name: trimmed });
      setIsEditing(false);
    } catch {
      toast.error('Failed to save name.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelName() {
    setNameVal(profile.display_name ?? '');
    setIsEditing(false);
  }

  const xpToNextRank = gam.nextRank
    ? `${(gam.xpRequiredForNextLevel - gam.xpIntoCurrentLevel).toLocaleString()} XP to ${gam.nextRank}`
    : 'Max rank reached';

  return (
    <div className="rounded-sm bg-surface border border-border p-5 space-y-4 mx-4">
      {/* Name row */}
      <div className="flex items-center gap-2">
        {isEditing ? (
          <>
            <input
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') handleCancelName(); }}
              className="flex-1 text-lg font-bold bg-transparent border-0 border-b border-foreground/30 rounded-none px-0 py-1 text-foreground focus:outline-none focus:border-foreground transition-colors"
              autoFocus
            />
            <button onClick={handleSaveName} disabled={isSaving} className="p-1 text-foreground">
              <Check className="h-4 w-4" />
            </button>
            <button onClick={handleCancelName} className="p-1 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </>
        ) : (
          <>
            <h2 className="flex-1 text-lg font-bold text-foreground">
              {profile.display_name ?? 'Athlete'}
            </h2>
            <button onClick={() => setIsEditing(true)} className="p-1 text-muted-foreground active:text-foreground">
              <Pencil className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* Rank + level */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-extrabold text-foreground italic">{gam.currentRank}</p>
          <p className="text-sm text-muted-foreground">Level {gam.currentLevel}</p>
        </div>
        <p className="text-xs text-muted-foreground tabular-nums">
          {gam.totalXp.toLocaleString()} XP total
        </p>
      </div>

      {/* XP bar */}
      <div className="space-y-1">
        <XPBar gamification={gam} />
        <p className="text-[10px] text-muted-foreground text-right">{xpToNextRank}</p>
      </div>
    </div>
  );
}
