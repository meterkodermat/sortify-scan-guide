import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Home, Recycle, Trash2 } from "lucide-react";

interface WasteItem {
  id: string;
  name: string;
  image: string;
  homeCategory: string;
  recyclingCategory: string;
  description: string;
  confidence: number;
  timestamp: Date;
}

interface RecentScansProps {
  scans: WasteItem[];
  onSelectScan: (scan: WasteItem) => void;
  onClearHistory: () => void;
}

export const RecentScans = ({ scans, onSelectScan, onClearHistory }: RecentScansProps) => {
  if (scans.length === 0) {
    return null;
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes} min siden`;
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} timer siden`;
    } else {
      return `${Math.floor(diffMinutes / 1440)} dage siden`;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Clock className="h-5 w-5 mr-2 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Seneste scanninger</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearHistory}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {scans.slice(0, 5).map((scan) => (
          <Card
            key={scan.id}
            className="p-4 cursor-pointer hover:shadow-card transition-all duration-300 bg-gradient-card"
            onClick={() => onSelectScan(scan)}
          >
            <div className="flex items-center space-x-4">
              <img
                src={scan.image}
                alt={scan.name}
                className="w-16 h-16 object-cover rounded-lg"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{scan.name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex items-center">
                    <Home className="h-3 w-3 mr-1 text-primary" />
                    <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                      {scan.homeCategory}
                    </Badge>
                  </div>
                  <div className="flex items-center">
                    <Recycle className="h-3 w-3 mr-1 text-accent" />
                    <Badge variant="secondary" className="text-xs bg-accent/10 text-accent">
                      {scan.recyclingCategory}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatTimestamp(scan.timestamp)}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};