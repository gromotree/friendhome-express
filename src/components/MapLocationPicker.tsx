import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';

// Fix for default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

export const MapLocationPicker = ({ onLocationSelect, initialLat = 13.0878, initialLng = 80.2085 }: MapLocationPickerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number]>([initialLat, initialLng]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(containerRef.current).setView(currentPosition, 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // Add click handler
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      
      // Remove existing marker if any
      if (markerRef.current) {
        markerRef.current.remove();
      }

      // Add new marker
      markerRef.current = L.marker([lat, lng]).addTo(map);
      
      setCurrentPosition([lat, lng]);
      onLocationSelect(lat, lng);
      toast.success('Location selected!');
    });

    mapRef.current = map;

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map view when position changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(currentPosition, 13);
    }
  }, [currentPosition]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const newPos: [number, number] = [lat, lng];
          
          setCurrentPosition(newPos);
          onLocationSelect(lat, lng);
          
          // Remove existing marker if any
          if (markerRef.current) {
            markerRef.current.remove();
          }
          
          // Add marker at current location
          if (mapRef.current) {
            markerRef.current = L.marker(newPos).addTo(mapRef.current);
            mapRef.current.setView(newPos, 15);
          }
          
          toast.success('Current location captured!');
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Failed to get current location');
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Select Delivery Location</h3>
        </div>
        <Button onClick={handleGetCurrentLocation} variant="outline" size="sm">
          <Navigation className="mr-2 h-4 w-4" />
          My Location
        </Button>
      </div>
      
      <div 
        ref={containerRef} 
        className="h-[400px] w-full rounded-lg overflow-hidden border"
        style={{ zIndex: 0 }}
      />
      
      <p className="text-xs text-muted-foreground mt-2">
        Click on the map to select your delivery location
      </p>
    </Card>
  );
};
