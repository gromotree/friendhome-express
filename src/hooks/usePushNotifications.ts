import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { requestNotificationPermission, subscribeToPushNotifications } from '@/lib/pushNotifications';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && 'serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => {
          checkSubscription();
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, [user]);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const enableNotifications = async () => {
    if (!user) {
      toast.error('Please sign in to enable notifications');
      return;
    }

    setLoading(true);
    try {
      const permissionGranted = await requestNotificationPermission();
      
      if (!permissionGranted) {
        toast.error('Notification permission denied');
        return;
      }

      const subscribed = await subscribeToPushNotifications(user.id);
      
      if (subscribed) {
        setIsSubscribed(true);
        toast.success('Notifications enabled!');
      } else {
        toast.error('Failed to enable notifications');
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast.error('Failed to enable notifications');
    } finally {
      setLoading(false);
    }
  };

  return {
    isSubscribed,
    loading,
    enableNotifications,
  };
}
