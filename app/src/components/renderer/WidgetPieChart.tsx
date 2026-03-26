import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { store } from '@/lib/mockData';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground">{payload[0].name}</p>
      <p className="font-semibold" style={{ color: payload[0].payload.fill }}>{payload[0].value.toLocaleString()}</p>
    </div>
  );
};

export default function WidgetPieChart({ props, dataBinding }) {
  const { title, nameKey = 'label', valueKey = 'value', donut = true } = props;

  let data = [];
  if (dataBinding?.collectionId) {
    const view = store.getView(dataBinding.viewId);
    const raw = store.getCollectionData(dataBinding.collectionId);
    data = raw.map((row, i) => ({
      name: row[view?.nameKey || nameKey] || row[nameKey] || row.channel || row.label,
      value: row[view?.valueKey || valueKey] || row[valueKey] || row.users || 0,
      fill: COLORS[i % COLORS.length],
    }));
  }

  return (
    <div className="bg-card rounded-xl p-5 h-full flex flex-col border border-border/60 hover:border-primary/30 transition-all duration-200 hover:shadow-md">
      <p className="text-sm font-semibold text-foreground mb-2">{title}</p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={donut ? '55%' : 0}
              outerRadius="80%"
              dataKey="value"
              paddingAngle={2}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.fill} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}