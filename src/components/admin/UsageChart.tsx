import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";

interface UsageRecord {
  user_id: string;
  count: number;
  date: string;
}

interface UsageChartProps {
  usageData: UsageRecord[];
}

export default function UsageChart({ usageData }: UsageChartProps) {
  const [tab, setTab] = useState("daily");

  const dailyData = useMemo(() => {
    const map = new Map<string, number>();
    usageData.forEach(u => {
      map.set(u.date, (map.get(u.date) || 0) + u.count);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, count]) => ({ date, count }));
  }, [usageData]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, number>();
    usageData.forEach(u => {
      const month = u.date.substring(0, 7);
      map.set(month, (map.get(month) || 0) + u.count);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));
  }, [usageData]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle>사용량 추이</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="daily">일별 (최근 30일)</TabsTrigger>
            <TabsTrigger value="monthly">월별 (최근 12개월)</TabsTrigger>
          </TabsList>
          <TabsContent value="daily">
            {dailyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">사용량 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                    labelFormatter={l => `날짜: ${l}`}
                    formatter={(v: number) => [`${v}회`, "사용량"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
          <TabsContent value="monthly">
            {monthlyData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">사용량 데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }}
                    labelFormatter={l => `월: ${l}`}
                    formatter={(v: number) => [`${v}회`, "사용량"]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
