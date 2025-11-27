import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';

interface MenuCardProps {
  id: string;
  title: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
}

export const MenuCard = ({ id, title, description, price, image_url, category }: MenuCardProps) => {
  const { addItem } = useCart();

  const handleAddToCart = () => {
    addItem({ id, title, price, image_url });
    toast.success(`${title} added to cart`);
  };

  return (
    <Card className="overflow-hidden transition-all hover:shadow-card-hover">
      <div className="aspect-video bg-muted relative overflow-hidden">
        {image_url ? (
          <img src={image_url} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            No image
          </div>
        )}
        <div className="absolute top-2 right-2 bg-background/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium">
          {category}
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{description}</p>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-primary">₹{price}</span>
          <Button onClick={handleAddToCart} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </Card>
  );
};
