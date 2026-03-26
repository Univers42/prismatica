// Central component dispatcher — resolves a component record to its React component
import WidgetKPI from './WidgetKPI';
import WidgetLineChart from './WidgetLineChart';
import WidgetPieChart from './WidgetPieChart';
import WidgetDataTable from './WidgetDataTable';
import WidgetKanban from './WidgetKanban';
import { ContentHeading, ContentDivider, ContentAlert, ContentRichText } from './ContentBlock';

export default function ComponentRenderer({ record, isEditing = false, isSelected = false, onClick }) {
  const { typeId, props = {}, dataBinding } = record;

  const renderComponent = () => {
    switch (typeId) {
      case 'widget.metric.kpi':
        return <WidgetKPI props={props} />;
      case 'widget.chart.line':
        return <WidgetLineChart props={props} dataBinding={dataBinding} chartType="line" />;
      case 'widget.chart.bar':
        return <WidgetLineChart props={props} dataBinding={dataBinding} chartType="bar" />;
      case 'widget.chart.area':
        return <WidgetLineChart props={props} dataBinding={dataBinding} chartType="area" />;
      case 'widget.chart.pie':
        return <WidgetPieChart props={props} dataBinding={dataBinding} />;
      case 'widget.table.data':
        return <WidgetDataTable props={props} dataBinding={dataBinding} />;
      case 'widget.kanban':
        return <WidgetKanban props={props} dataBinding={dataBinding} />;
      case 'content.heading':
        return <ContentHeading props={props} />;
      case 'content.divider':
        return <ContentDivider props={props} />;
      case 'content.alert':
        return <ContentAlert props={props} />;
      case 'content.richtext':
        return <ContentRichText props={props} />;
      default:
        return (
          <div className="bg-card rounded-xl p-5 h-full border border-dashed border-border/60 flex items-center justify-center">
            <p className="text-xs text-muted-foreground font-mono">{typeId}</p>
          </div>
        );
    }
  };

  if (isEditing) {
    return (
      <div
        onClick={onClick}
        className={`h-full w-full rounded-xl cursor-pointer ring-2 transition-all duration-150 ${
          isSelected ? 'ring-primary shadow-lg shadow-primary/20' : 'ring-transparent hover:ring-primary/30'
        }`}
      >
        {renderComponent()}
      </div>
    );
  }

  return <div className="h-full w-full">{renderComponent()}</div>;
}