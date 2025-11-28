-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true);

-- Create storage policies for menu images
CREATE POLICY "Menu images are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'menu-images');

CREATE POLICY "Admins can upload menu images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'menu-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update menu images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'menu-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete menu images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'menu-images' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Create push_subscriptions table for web push notifications
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for push subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);