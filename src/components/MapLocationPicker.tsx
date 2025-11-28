import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { Icon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, Navigation } from 'lucide-react';

// Fix for default marker icon
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface MapLocationPickerProps {
  onLocationSelect: (lat: number, lng: number) => void;
  initialLat?: number;
  initialLng?: number;
}

function LocationMarker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  const [position, setPosition] = useState<[number, number] | null>(null);

  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    map.locate();
  }, [map]);

  return position === null ? null : <Marker position={position} />;
}

export const MapLocationPicker = ({ onLocationSelect, initialLat = 13.0878, initialLng = 80.2085 }: MapLocationPickerProps) => {
  const [currentPosition, setCurrentPosition] = useState<[number, number]>([initialLat, initialLng]);

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentPosition([lat, lng]);
          onLocationSelect(lat, lng);
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
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
      
      <div className="h-[400px] w-full rounded-lg overflow-hidden border">
        <MapContainer
          center={currentPosition}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          key={`${currentPosition[0]}-${currentPosition[1]}`}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker onLocationSelect={onLocationSelect} />
        </MapContainer>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        Click on the map to select your delivery location
      </p>
    </Card>
  );
};
