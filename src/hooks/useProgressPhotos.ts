import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { ProgressPhoto } from '@/types';

const BUCKET = 'progress-photos';
/** Signed URL TTL — 1 hour in seconds. */
const SIGNED_URL_TTL = 3600;

export interface ProgressPhotoWithUrl extends ProgressPhoto {
  /** Temporary signed URL for displaying the image. Null if generation failed. */
  signedUrl: string | null;
}

interface UseProgressPhotosReturn {
  photos: ProgressPhotoWithUrl[];
  isLoading: boolean;
  error: string | null;
  /**
   * Uploads a photo file to Supabase Storage and inserts a progress_photos row.
   * @param file    - The image file selected by the user.
   * @param takenOn - ISO date string (YYYY-MM-DD) the photo represents.
   * @param notes   - Optional note.
   */
  uploadPhoto: (file: File, takenOn: string, notes?: string) => Promise<void>;
  deletePhoto: (id: string, storagePath: string) => Promise<void>;
}

/**
 * Loads progress photos for the current user and generates signed URLs
 * so private bucket images can be displayed in <img> tags.
 */
export function useProgressPhotos(): UseProgressPhotosReturn {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<ProgressPhotoWithUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);

    const { data, error: dbError } = await supabase
      .from('progress_photos')
      .select('*')
      .eq('user_id', user.id)
      .order('taken_on', { ascending: false });

    if (dbError) { setError(dbError.message); return; }

    const rows = (data ?? []) as ProgressPhoto[];

    // Generate signed URLs for all photos in one pass
    const withUrls = await Promise.all(
      rows.map(async (photo) => {
        const { data: urlData, error: urlErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(photo.storage_path, SIGNED_URL_TTL);

        return {
          ...photo,
          signedUrl: urlErr ? null : (urlData?.signedUrl ?? null),
        };
      }),
    );

    setPhotos(withUrls);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchPhotos().finally(() => setIsLoading(false));
  }, [user, fetchPhotos]);

  const uploadPhoto = useCallback(
    async (file: File, takenOn: string, notes?: string) => {
      if (!user) throw new Error('Not authenticated.');

      // Derive a unique storage path: {userId}/{timestamp}.{ext}
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filename = `${Date.now()}.${ext}`;
      const storagePath = `${user.id}/${filename}`;

      // 1. Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { upsert: false });

      if (uploadErr) throw new Error(uploadErr.message);

      // 2. Insert the metadata row
      const { data: rowData, error: insertErr } = await supabase
        .from('progress_photos')
        .insert({
          user_id: user.id,
          storage_path: storagePath,
          taken_on: takenOn,
          notes: notes ?? null,
        })
        .select()
        .single();

      if (insertErr) throw new Error(insertErr.message);

      // 3. Generate a signed URL for immediate display
      const { data: urlData } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(storagePath, SIGNED_URL_TTL);

      const newPhoto: ProgressPhotoWithUrl = {
        ...(rowData as ProgressPhoto),
        signedUrl: urlData?.signedUrl ?? null,
      };

      setPhotos((prev) => [newPhoto, ...prev]);
    },
    [user],
  );

  const deletePhoto = useCallback(
    async (id: string, storagePath: string) => {
      if (!user) throw new Error('Not authenticated.');

      // Delete from storage first
      await supabase.storage.from(BUCKET).remove([storagePath]);

      // Then delete the metadata row
      const { error: dbError } = await supabase
        .from('progress_photos')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (dbError) throw new Error(dbError.message);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    },
    [user],
  );

  return { photos, isLoading, error, uploadPhoto, deletePhoto };
}
