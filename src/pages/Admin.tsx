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
import { MenuImageUpload } from '@/components/MenuImageUpload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

type OrderStatus = 'placed' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';

interface MenuItem {
  id: string;
  title: string;
  description: string | null;
  price: number;
  category: string;
  image_url: string | null;
  is_available: boolean | null;
}

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
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddMenuItem, setShowAddMenuItem] = useState(false);
  const [newMenuItem, setNewMenuItem] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
  });
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
      fetchMenuItems();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    }
  };

  const fetchMenuItems = async () => {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setMenuItems(data || []);
    } catch (error) {
      console.error('Error fetching menu items:', error);
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

  const handleAddMenuItem = async () => {
    if (!newMenuItem.title || !newMenuItem.price || !newMenuItem.category) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      const { error } = await supabase
        .from('menu_items')
        .insert({
          title: newMenuItem.title,
          description: newMenuItem.description || null,
          price: parseFloat(newMenuItem.price),
          category: newMenuItem.category,
          is_available: true,
        });

      if (error) throw error;

      toast.success('Menu item added successfully');
      setShowAddMenuItem(false);
      setNewMenuItem({ title: '', description: '', price: '', category: '' });
      fetchMenuItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add menu item');
    }
  };

  const toggleMenuItemAvailability = async (itemId: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from('menu_items')
        .update({ is_available: !currentStatus })
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Menu item updated');
      fetchMenuItems();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update menu item');
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
            <TabsTrigger value="menu">Menu Items ({menuItems.length})</TabsTrigger>
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

          <TabsContent value="menu" className="space-y-4 mt-6">
            <div className="flex justify-end mb-4">
              <Dialog open={showAddMenuItem} onOpenChange={setShowAddMenuItem}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Menu Item
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Menu Item</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={newMenuItem.title}
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, title: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={newMenuItem.description}
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, description: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="price">Price (₹) *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={newMenuItem.price}
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, price: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Category *</Label>
                      <Input
                        id="category"
                        value={newMenuItem.category}
                        onChange={(e) => setNewMenuItem({ ...newMenuItem, category: e.target.value })}
                        placeholder="e.g., Appetizers, Main Course, Desserts"
                      />
                    </div>
                    <Button onClick={handleAddMenuItem} className="w-full">
                      Add Item
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {menuItems.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="space-y-4">
                    <MenuImageUpload
                      menuItemId={item.id}
                      currentImageUrl={item.image_url || undefined}
                      onImageUploaded={fetchMenuItems}
                    />
                    
                    <div>
                      <h3 className="font-semibold text-lg">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                      <p className="text-lg font-bold text-primary mt-2">₹{item.price}</p>
                      <Badge variant="outline" className="mt-1">{item.category}</Badge>
                    </div>

                    <Button
                      onClick={() => toggleMenuItemAvailability(item.id, item.is_available)}
                      variant={item.is_available ? 'default' : 'secondary'}
                      className="w-full"
                    >
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
