/**
 * Hand-written database type stub that mirrors the Stride schema.
 *
 * Replace with auto-generated types by running:
 *   npx supabase gen types typescript --project-id <YOUR_PROJECT_ID> \
 *     > src/lib/database.types.ts
 *
 * The Insert types use optional fields where the DB provides a default,
 * matching what Supabase's code generator would produce.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          weight_unit: string;
          total_xp: number;
          bodyweight_reminder_time: string | null;
          progress_photo_reminder_day: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          weight_unit?: string;
          total_xp?: number;
          bodyweight_reminder_time?: string | null;
          progress_photo_reminder_day?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          weight_unit?: string;
          total_xp?: number;
          bodyweight_reminder_time?: string | null;
          progress_photo_reminder_day?: string | null;
          updated_at?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          user_id: string | null;
          name: string;
          category: string;
          equipment_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name: string;
          category: string;
          equipment_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string;
          category?: string;
          equipment_type?: string;
        };
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
          xp_earned: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
          xp_earned?: number;
          created_at?: string;
        };
        Update: {
          ended_at?: string | null;
          notes?: string | null;
          xp_earned?: number;
        };
      };
      sets: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          set_number: number;
          weight_lbs: number;
          reps: number;
          logged_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          set_number: number;
          weight_lbs: number;
          reps: number;
          logged_at?: string;
          notes?: string | null;
        };
        Update: {
          weight_lbs?: number;
          reps?: number;
          notes?: string | null;
        };
      };
      bodyweight_logs: {
        Row: {
          id: string;
          user_id: string;
          weight_lbs: number;
          logged_at: string;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          weight_lbs: number;
          logged_at?: string;
          notes?: string | null;
        };
        Update: {
          weight_lbs?: number;
          notes?: string | null;
        };
      };
      progress_photos: {
        Row: {
          id: string;
          user_id: string;
          storage_path: string;
          taken_on: string;
          notes: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          storage_path: string;
          taken_on: string;
          notes?: string | null;
          uploaded_at?: string;
        };
        Update: {
          taken_on?: string;
          notes?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
