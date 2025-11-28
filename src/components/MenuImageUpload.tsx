import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, X } from 'lucide-react';

interface MenuImageUploadProps {
  menuItemId: string;
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
}

export const MenuImageUpload = ({ menuItemId, currentImageUrl, onImageUploaded }: MenuImageUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl || '');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${menuItemId}-${Date.now()}.${fileExt}`;
      const filePath = fileName;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);

      const publicUrl = data.publicUrl;

      // Update menu item with image URL
      const { error: updateError } = await supabase
        .from('menu_items')
        .update({ image_url: publicUrl })
        .eq('id', menuItemId);

      if (updateError) throw updateError;

      setPreviewUrl(publicUrl);
      onImageUploaded(publicUrl);
      toast.success('Image uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ image_url: null })
        .eq('id', menuItemId);

      if (error) throw error;

      setPreviewUrl('');
      onImageUploaded('');
      toast.success('Image removed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove image');
    }
  };

  return (
    <div className="space-y-3">
      <Label>Menu Item Image</Label>
      
      {previewUrl && (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border">
          <img src={previewUrl} alt="Menu item" className="w-full h-full object-cover" />
          <Button
            onClick={handleRemoveImage}
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          id={`image-upload-${menuItemId}`}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
        />
        <Label
          htmlFor={`image-upload-${menuItemId}`}
          className="cursor-pointer"
        >
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            asChild
          >
            <span>
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading...' : previewUrl ? 'Change Image' : 'Upload Image'}
            </span>
          </Button>
        </Label>
      </div>
      
      <p className="text-xs text-muted-foreground">
        Max size: 5MB. Supported formats: JPG, PNG, WebP
      </p>
    </div>
  );
};
