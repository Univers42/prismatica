import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, BarChart, Bar } from 'recharts';
import { store } from '@/lib/mockData';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {typeof p.value === 'number' && p.value > 999
            ? `$${(p.value / 1000).toFixed(1)}k`
            : p.value}
        </p>
      ))}
    </div>
  );
};

export default function WidgetLineChart({ props, dataBinding, chartType = 'line' }) {
  const { title, xKey = 'date', yKey = 'value', color = '#6366f1' } = props;

  let data = [];
  if (dataBinding?.collectionId) {
    data = store.getCollectionData(dataBinding.collectionId);
  }

  const ChartComponent = chartType === 'area' ? AreaChart : chartType === 'bar' ? BarChart : LineChart;

  return (
    <div className="bg-card rounded-xl p-5 h-full flex flex-col border border-border/60 hover:border-primary/30 transition-all duration-200 hover:shadow-md">
      <p className="text-sm font-semibold text-foreground mb-4">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false}
              tickFormatter={v => v > 999 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={<CustomTooltip />} />
            {chartType === 'area' && (
              <Area type="monotone" dataKey={yKey} stroke={color} fill={`${color}20`} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            )}
            {chartType === 'bar' && (
              <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
            )}
            {chartType === 'line' && (
              <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
}