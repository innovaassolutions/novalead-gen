"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const COLORS = ["#0ea5e9", "#22c55e", "#eab308", "#ef4444", "#8b5cf6", "#f97316", "#ec4899"];

export function LeadsByStatusChart() {
  const stats = useQuery(api.leads.getStats);

  if (!stats) return null;

  const data = Object.entries(stats)
    .filter(([key]) => key !== "total")
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    .filter(d => (d.value as number) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leads by Status</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={(props: any) => `${props.name} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No lead data yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JobsByTypeChart() {
  const stats = useQuery(api.jobs.getStats);

  if (!stats) return null;

  const data = Object.entries(stats.byType)
    .map(([name, value]) => ({ name: name.replace(/_/g, " "), count: value }))
    .filter(d => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jobs by Type</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
              <XAxis type="number" />
              <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[300px] items-center justify-center">
            <p className="text-sm text-muted-foreground">No job data yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
