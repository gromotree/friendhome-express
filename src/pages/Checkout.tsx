import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { MapPin } from 'lucide-react';
import { z } from 'zod';

// FriendHome location (Anna Nagar)
const RESTAURANT_LAT = 13.0878;
const RESTAURANT_LNG = 80.2085;
const MAX_DELIVERY_DISTANCE = 10; // KM

const addressSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  address_line: z.string().min(10, 'Address must be at least 10 characters'),
  latitude: z.number(),
  longitude: z.number(),
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (items.length === 0) {
      navigate('/');
      return;
    }
  }, [user, items, navigate]);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          toast.success('Location captured!');
        },
        (error) => {
          toast.error('Failed to get location. Please enter manually.');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  const handlePlaceOrder = async () => {
    if (!user || !latitude || !longitude) {
      toast.error('Please provide delivery location');
      return;
    }

    const validation = addressSchema.safeParse({
      label,
      address_line: addressLine,
      latitude,
      longitude,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    const distance = calculateDistance(RESTAURANT_LAT, RESTAURANT_LNG, latitude, longitude);

    if (distance > MAX_DELIVERY_DISTANCE) {
      toast.error(`Sorry, we only deliver within ${MAX_DELIVERY_DISTANCE}km. Your location is ${distance.toFixed(1)}km away.`);
      return;
    }

    setLoading(true);

    try {
      // Create address
      const { data: addressData, error: addressError } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          label,
          address_line: addressLine,
          latitude,
          longitude,
        })
        .select()
        .single();

      if (addressError) throw addressError;

      // Calculate totals
      const subtotal = total;
      const tax = subtotal * 0.05; // 5% tax
      const deliveryFee = 30;
      const orderTotal = subtotal + tax + deliveryFee;

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          address_id: addressData.id,
          subtotal,
          tax,
          delivery_fee: deliveryFee,
          total: orderTotal,
          distance_km: distance,
          notes,
          status: 'placed',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = items.map(item => ({
        order_id: orderData.id,
        menu_item_id: item.id,
        quantity: item.quantity,
        price: item.price,
        item_title: item.title,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success('Order placed successfully!');
      clearCart();
      navigate(`/orders/${orderData.id}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const subtotal = total;
  const tax = subtotal * 0.05;
  const deliveryFee = 30;
  const orderTotal = subtotal + tax + deliveryFee;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Delivery Address</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="label">Address Label</Label>
                <Input
                  id="label"
                  placeholder="Home, Office, etc."
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="address">Complete Address</Label>
                <Textarea
                  id="address"
                  placeholder="House/Flat no, Street, Landmark"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  rows={3}
                />
              </div>
              <Button onClick={handleGetLocation} variant="outline" className="w-full">
                <MapPin className="mr-2 h-4 w-4" />
                Get Current Location
              </Button>
              {latitude && longitude && (
                <p className="text-sm text-muted-foreground">
                  Location: {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </p>
              )}
              <div>
                <Label htmlFor="notes">Delivery Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special instructions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span>{item.title} x {item.quantity}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (5%)</span>
                    <span>₹{tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee</span>
                    <span>₹{deliveryFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>Total</span>
                    <span className="text-primary">₹{orderTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Card>

            <Button 
              onClick={handlePlaceOrder} 
              className="w-full" 
              size="lg"
              disabled={loading || !latitude || !longitude}
            >
              {loading ? 'Placing Order...' : 'Place Order'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
