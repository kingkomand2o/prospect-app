import { Card, CardContent } from "@/components/ui/card";
import { Users, MessageCircle, Clock, AlertTriangle } from "lucide-react";
import type { Prospect } from "@shared/schema";

interface StatsCardsProps {
  prospects: Prospect[];
}

export default function StatsCards({ prospects }: StatsCardsProps) {
  const totalProspects = prospects.length;
  const messagesSent = prospects.filter(p => p.status === 'sent').length;
  const pending = prospects.filter(p => p.status === 'pending').length;
  const failed = prospects.filter(p => p.status === 'failed').length;
  const successRate = totalProspects > 0 ? Math.round((messagesSent / totalProspects) * 100) : 0;

  const stats = [
    {
      title: "Total Prospects",
      value: totalProspects,
      icon: Users,
      color: "bg-primary-100 text-primary-600",
      bgColor: "bg-primary-50"
    },
    {
      title: "Messages Sent",
      value: messagesSent,
      icon: MessageCircle,
      color: "bg-green-100 text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "Pending",
      value: pending,
      icon: Clock,
      color: "bg-yellow-100 text-yellow-600",
      bgColor: "bg-yellow-50"
    },
    {
      title: "Success Rate",
      value: `${successRate}%`,
      icon: AlertTriangle,
      color: "bg-blue-100 text-blue-600",
      bgColor: "bg-blue-50"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className="text-2xl font-semibold text-slate-800">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
