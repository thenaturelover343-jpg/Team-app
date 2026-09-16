import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { GeoLocation, getCurrentLocation } from '../types';
import { Loader2, MapPin } from 'lucide-react';

// Fix for default Leaflet marker icon in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function LiveLocationMap({ onLocationFound }: { onLocationFound?: (loc: GeoLocation) => void }) {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoc = async () => {
      try {
        const loc = await getCurrentLocation();
        setLocation(loc);
        if (onLocationFound) onLocationFound(loc);
      } catch (err: any) {
        setError(err.message || 'Locatie niet beschikbaar');
      } finally {
        setLoading(false);
      }
    };
    fetchLoc();
  }, [onLocationFound]);

  if (loading) {
    return (
      <div className="bg-slate-100 rounded-xl h-48 flex flex-col items-center justify-center text-slate-500 space-y-2 border border-slate-200">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-900" />
        <span className="text-sm font-medium">Locatie bepalen...</span>
      </div>
    );
  }

  if (error || !location) {
    return (
      <div className="bg-red-50 rounded-xl h-48 flex flex-col items-center justify-center text-red-500 space-y-2 border border-red-100 p-4 text-center">
        <MapPin className="w-6 h-6" />
        <span className="text-sm font-medium">Kan uw locatie niet weergeven: {error}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden h-48 border border-slate-200 shadow-sm relative z-0">
      <MapContainer 
        center={[location.lat, location.lng]} 
        zoom={16} 
        scrollWheelZoom={false}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[location.lat, location.lng]}>
          <Popup>
            Huidige locatie:<br/>
            {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
          </Popup>
        </Marker>
        <MapUpdater center={[location.lat, location.lng]} />
      </MapContainer>
      <div className="absolute top-2 right-2 z-[1000] bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm text-[10px] font-bold text-slate-600 border border-slate-200 flex items-center space-x-1">
        <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
        <span>Live GPS</span>
      </div>
    </div>
  );
}
