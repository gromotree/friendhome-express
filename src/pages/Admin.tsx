import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type OrderStatus = 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  user_id: string;
  profiles: {
    full_name: string | null;
    phone: string;
  } | null;
  addresses: {
    address_line: string;
  } | null;
  order_items: Array<{
    quantity: number;
    item_title: string;
  }>;
}

const statusColors = {
  placed: 'bg-blue-500',
  preparing: 'bg-yellow-500',
  out_for_delivery: 'bg-purple-500',
  delivered: 'bg-green-500',
  cancelled: 'bg-red-500',
};

export default function Admin() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    checkAdminStatus();
  }, [user, navigate]);

  const checkAdminStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('Access denied. Admin privileges required.');
        navigate('/');
        return;
      }

      setIsAdmin(true);
      fetchOrders();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    }
  };

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          addresses (address_line),
          order_items (quantity, item_title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const ordersWithProfiles = await Promise.all(
        (data || []).map(async (order) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', order.user_id)
            .single();
          
          return { ...order, profiles: profile };
        })
      );

      setOrders(ordersWithProfiles as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Order status updated');
      fetchOrders();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container py-8">
          <p>Checking permissions...</p>
        </div>
      </div>
    );
  }

  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.status));
  const completedOrders = orders.filter(o => ['delivered', 'cancelled'].includes(o.status));

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container py-8">
        <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>

        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Active Orders ({activeOrders.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completedOrders.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4 mt-6">
            {activeOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No active orders</p>
              </Card>
            ) : (
              activeOrders.map(order => (
                <Card key={order.id} className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold">{order.profiles?.full_name || 'Guest'}</p>
                      <p className="text-sm text-muted-foreground">{order.profiles?.phone}</p>
                      <p className="text-sm mt-1">{order.addresses?.address_line}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(order.created_at), 'PPp')}
                      </p>
                    </div>
                    <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                      {order.status}
                    </Badge>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">Items:</p>
                    <ul className="text-sm space-y-1">
                      {order.order_items.map((item, idx) => (
                        <li key={idx}>{item.quantity}x {item.item_title}</li>
                      ))}
                    </ul>
                    <p className="text-lg font-bold text-primary mt-2">₹{order.total.toFixed(2)}</p>
                  </div>

                  <div className="flex gap-2">
                    <Select
                      value={order.status}
                      onValueChange={(value) => updateOrderStatus(order.id, value as OrderStatus)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="placed">Placed</SelectItem>
                        <SelectItem value="preparing">Preparing</SelectItem>
                        <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4 mt-6">
            {completedOrders.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No completed orders</p>
              </Card>
            ) : (
              completedOrders.map(order => (
                <Card key={order.id} className="p-6 opacity-75">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{order.profiles?.full_name || 'Guest'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'PPp')}
                      </p>
                      <p className="text-sm mt-2">
                        {order.order_items.map(i => `${i.quantity}x ${i.item_title}`).join(', ')}
                      </p>
                      <p className="font-bold text-primary mt-1">₹{order.total.toFixed(2)}</p>
                    </div>
                    <Badge className={statusColors[order.status as keyof typeof statusColors]}>
                      {order.status}
                    </Badge>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
