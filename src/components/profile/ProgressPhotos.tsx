import { useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useProgressPhotos } from '@/hooks/useProgressPhotos';
import type { ProgressPhotoWithUrl } from '@/hooks/useProgressPhotos';

// ─── Client-side image resize ────────────────────────────────────────────────

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DIM = 1920;

async function resizeIfNeeded(file: File): Promise<File> {
  // If already small enough and not an unsupported type, upload as-is
  if (file.size <= MAX_BYTES && file.type !== 'image/heic') return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed.')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.82,
      );
    };

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed.')); };
    img.src = objectUrl;
  });
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  photo,
  onClose,
  onDelete,
}: {
  photo: ProgressPhotoWithUrl;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm bg-surface border-border p-0 overflow-hidden">
        {photo.signedUrl && (
          <img
            src={photo.signedUrl}
            alt={`Progress photo ${photo.taken_on}`}
            className="w-full object-cover max-h-[60dvh]"
          />
        )}
        <div className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {format(parseISO(photo.taken_on), 'MMMM d, yyyy')}
            </p>
            {photo.notes && (
              <p className="text-xs text-muted-foreground mt-0.5">{photo.notes}</p>
            )}
          </div>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-destructive/70 active:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProgressPhotos() {
  const { photos, uploadPhoto, deletePhoto } = useProgressPhotos();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<ProgressPhotoWithUrl | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be selected again
    e.target.value = '';

    setIsUploading(true);
    try {
      const resized = await resizeIfNeeded(file);
      const takenOn = new Date().toISOString().slice(0, 10);
      await uploadPhoto(resized, takenOn);
      toast.success('Photo uploaded!');
    } catch {
      toast.error('Failed to upload photo.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-3 px-4">
      {/* Upload button */}
      <div className="flex justify-end">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="flex items-center gap-1.5 text-sm text-foreground font-bold underline underline-offset-2 active:opacity-70 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {isUploading ? 'Uploading…' : 'Add Photo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Grid */}
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No progress photos yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setLightboxPhoto(photo)}
              className="aspect-square rounded-lg overflow-hidden bg-border active:opacity-80 transition-opacity"
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.taken_on}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <X className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <Lightbox
          photo={lightboxPhoto}
          onClose={() => setLightboxPhoto(null)}
          onDelete={() => deletePhoto(lightboxPhoto.id, lightboxPhoto.storage_path)}
        />
      )}
    </div>
  );
}
