// ─── Mock Data Store ────────────────────────────────────────────────────────
// Central in-memory store simulating the metadata database.
// In production this would be replaced by real entity persistence.

export const MOCK_SHELLS = [
  {
    id: 'shell-blank',
    name: 'Blank',
    description: 'Single full-width content area',
    icon: 'Square',
    slots: [
      { id: 'main', name: 'Main', colSpan: 12, rowSpan: 1, order: 0 },
    ],
    gridCols: 12,
  },
  {
    id: 'shell-sidebar-main',
    name: 'Sidebar + Main',
    description: 'Fixed sidebar with scrollable main area',
    icon: 'PanelLeft',
    slots: [
      { id: 'sidebar', name: 'Sidebar', colSpan: 3, rowSpan: 2, order: 0 },
      { id: 'main', name: 'Main', colSpan: 9, rowSpan: 2, order: 1 },
    ],
    gridCols: 12,
  },
  {
    id: 'shell-header-3col',
    name: 'Header + 3 Col Grid',
    description: 'Top header bar with 3-column widget grid',
    icon: 'LayoutGrid',
    slots: [
      { id: 'header', name: 'Header', colSpan: 12, rowSpan: 1, order: 0 },
      { id: 'col-1', name: 'Column 1', colSpan: 4, rowSpan: 1, order: 1 },
      { id: 'col-2', name: 'Column 2', colSpan: 4, rowSpan: 1, order: 2 },
      { id: 'col-3', name: 'Column 3', colSpan: 4, rowSpan: 1, order: 3 },
    ],
    gridCols: 12,
  },
  {
    id: 'shell-kpi-grid',
    name: 'KPI Dashboard',
    description: 'Header KPIs + chart row + table',
    icon: 'BarChart2',
    slots: [
      { id: 'kpi-1', name: 'KPI 1', colSpan: 3, rowSpan: 1, order: 0 },
      { id: 'kpi-2', name: 'KPI 2', colSpan: 3, rowSpan: 1, order: 1 },
      { id: 'kpi-3', name: 'KPI 3', colSpan: 3, rowSpan: 1, order: 2 },
      { id: 'kpi-4', name: 'KPI 4', colSpan: 3, rowSpan: 1, order: 3 },
      { id: 'chart-main', name: 'Main Chart', colSpan: 8, rowSpan: 2, order: 4 },
      { id: 'chart-side', name: 'Side Chart', colSpan: 4, rowSpan: 2, order: 5 },
      { id: 'table', name: 'Data Table', colSpan: 12, rowSpan: 2, order: 6 },
    ],
    gridCols: 12,
  },
  {
    id: 'shell-2col-equal',
    name: 'Two Equal Columns',
    description: 'Side-by-side equal width columns',
    icon: 'Columns2',
    slots: [
      { id: 'left', name: 'Left', colSpan: 6, rowSpan: 1, order: 0 },
      { id: 'right', name: 'Right', colSpan: 6, rowSpan: 1, order: 1 },
    ],
    gridCols: 12,
  },
  {
    id: 'shell-project-board',
    name: 'Project Board',
    description: 'Header + kanban board area',
    icon: 'Kanban',
    slots: [
      { id: 'header', name: 'Header', colSpan: 12, rowSpan: 1, order: 0 },
      { id: 'stats-1', name: 'Stat 1', colSpan: 3, rowSpan: 1, order: 1 },
      { id: 'stats-2', name: 'Stat 2', colSpan: 3, rowSpan: 1, order: 2 },
      { id: 'stats-3', name: 'Stat 3', colSpan: 3, rowSpan: 1, order: 3 },
      { id: 'stats-4', name: 'Stat 4', colSpan: 3, rowSpan: 1, order: 4 },
      { id: 'kanban', name: 'Kanban Board', colSpan: 12, rowSpan: 3, order: 5 },
    ],
    gridCols: 12,
  },
];

export const COMPONENT_REGISTRY = [
  // Widgets
  { typeId: 'widget.metric.kpi', category: 'Widget', name: 'KPI Card', description: 'Key metric with trend indicator', icon: 'TrendingUp', color: 'bg-violet-500', supportsBinding: true, defaultProps: { title: 'Metric', value: '0', trend: '+0%', trendDirection: 'up', prefix: '', suffix: '' } },
  { typeId: 'widget.chart.line', category: 'Widget', name: 'Line Chart', description: 'Time-series line chart', icon: 'LineChart', color: 'bg-blue-500', supportsBinding: true, defaultProps: { title: 'Line Chart', xKey: 'date', yKey: 'value', color: '#6366f1' } },
  { typeId: 'widget.chart.bar', category: 'Widget', name: 'Bar Chart', description: 'Categorical bar chart', icon: 'BarChart2', color: 'bg-blue-500', supportsBinding: true, defaultProps: { title: 'Bar Chart', xKey: 'label', yKey: 'value', color: '#6366f1' } },
  { typeId: 'widget.chart.pie', category: 'Widget', name: 'Pie Chart', description: 'Proportional pie/donut chart', icon: 'PieChart', color: 'bg-blue-500', supportsBinding: true, defaultProps: { title: 'Pie Chart', nameKey: 'label', valueKey: 'value', donut: true } },
  { typeId: 'widget.chart.area', category: 'Widget', name: 'Area Chart', description: 'Stacked area visualization', icon: 'AreaChart', color: 'bg-blue-500', supportsBinding: true, defaultProps: { title: 'Area Chart', xKey: 'date', yKey: 'value', color: '#6366f1' } },
  { typeId: 'widget.table.data', category: 'Widget', name: 'Data Table', description: 'Sortable, filterable data table', icon: 'Table', color: 'bg-emerald-500', supportsBinding: true, defaultProps: { title: 'Table', pageSize: 10, sortable: true } },
  { typeId: 'widget.kanban', category: 'Widget', name: 'Kanban Board', description: 'Card-based kanban view', icon: 'Kanban', color: 'bg-orange-500', supportsBinding: true, defaultProps: { title: 'Kanban', groupField: 'status' } },
  { typeId: 'widget.progress', category: 'Widget', name: 'Progress Bar', description: 'Progress or gauge indicator', icon: 'Gauge', color: 'bg-amber-500', supportsBinding: false, defaultProps: { title: 'Progress', value: 65, max: 100, color: '#6366f1' } },
  { typeId: 'widget.activity', category: 'Widget', name: 'Activity Feed', description: 'Chronological event timeline', icon: 'Activity', color: 'bg-pink-500', supportsBinding: true, defaultProps: { title: 'Recent Activity', limit: 10 } },

  // Content
  { typeId: 'content.richtext', category: 'Content', name: 'Rich Text', description: 'Formatted text block', icon: 'FileText', color: 'bg-slate-500', supportsBinding: false, defaultProps: { content: '# Title\n\nAdd your content here...' } },
  { typeId: 'content.heading', category: 'Content', name: 'Heading', description: 'Section heading with optional subtitle', icon: 'Heading', color: 'bg-slate-500', supportsBinding: false, defaultProps: { text: 'Section Heading', subtitle: '', level: 'h2' } },
  { typeId: 'content.divider', category: 'Content', name: 'Divider', description: 'Horizontal separator line', icon: 'Minus', color: 'bg-slate-400', supportsBinding: false, defaultProps: { style: 'solid' } },
  { typeId: 'content.alert', category: 'Content', name: 'Alert Banner', description: 'Notification or info banner', icon: 'Bell', color: 'bg-yellow-500', supportsBinding: false, defaultProps: { message: 'Alert message', variant: 'info', dismissible: true } },
  { typeId: 'content.image', category: 'Content', name: 'Image', description: 'Image or media embed', icon: 'Image', color: 'bg-slate-500', supportsBinding: false, defaultProps: { src: '', alt: '', fit: 'cover' } },

  // Layout
  { typeId: 'layout.tabs', category: 'Layout', name: 'Tabs', description: 'Tabbed content container', icon: 'PanelTop', color: 'bg-indigo-500', supportsBinding: false, slots: ['tab-1', 'tab-2', 'tab-3'], defaultProps: { tabs: ['Tab 1', 'Tab 2', 'Tab 3'] } },
  { typeId: 'layout.accordion', category: 'Layout', name: 'Accordion', description: 'Collapsible content sections', icon: 'ChevronsUpDown', color: 'bg-indigo-500', supportsBinding: false, defaultProps: { sections: ['Section 1', 'Section 2'] } },

  // Navigation
  { typeId: 'nav.breadcrumb', category: 'Navigation', name: 'Breadcrumb', description: 'Navigation breadcrumb trail', icon: 'ChevronRight', color: 'bg-teal-500', supportsBinding: false, defaultProps: { items: ['Home', 'Section', 'Page'] } },
  { typeId: 'nav.pagelink', category: 'Navigation', name: 'Page Link Button', description: 'Button linking to another page', icon: 'ExternalLink', color: 'bg-teal-500', supportsBinding: false, defaultProps: { label: 'Go to Page', pageId: '' } },
];

export const MOCK_COLLECTIONS = [
  {
    id: 'col-mrr',
    name: 'MRR Metrics',
    fields: [
      { id: 'f1', name: 'date', type: 'date' },
      { id: 'f2', name: 'mrr', type: 'number' },
      { id: 'f3', name: 'new_mrr', type: 'number' },
      { id: 'f4', name: 'churned_mrr', type: 'number' },
    ],
    rows: [
      { date: '2025-08', mrr: 42000, new_mrr: 6200, churned_mrr: 1100 },
      { date: '2025-09', mrr: 47100, new_mrr: 7400, churned_mrr: 2300 },
      { date: '2025-10', mrr: 52200, new_mrr: 8100, churned_mrr: 3000 },
      { date: '2025-11', mrr: 57000, new_mrr: 6500, churned_mrr: 1700 },
      { date: '2025-12', mrr: 61500, new_mrr: 7200, churned_mrr: 2700 },
      { date: '2026-01', mrr: 65800, new_mrr: 8400, churned_mrr: 4100 },
      { date: '2026-02', mrr: 70100, new_mrr: 9300, churned_mrr: 5000 },
      { date: '2026-03', mrr: 74800, new_mrr: 8700, churned_mrr: 4000 },
    ],
  },
  {
    id: 'col-users',
    name: 'User Growth',
    fields: [
      { id: 'f1', name: 'date', type: 'date' },
      { id: 'f2', name: 'total_users', type: 'number' },
      { id: 'f3', name: 'active_users', type: 'number' },
      { id: 'f4', name: 'churned_users', type: 'number' },
    ],
    rows: [
      { date: '2025-08', total_users: 1200, active_users: 890, churned_users: 45 },
      { date: '2025-09', total_users: 1480, active_users: 1100, churned_users: 60 },
      { date: '2025-10', total_users: 1830, active_users: 1390, churned_users: 80 },
      { date: '2025-11', total_users: 2100, active_users: 1620, churned_users: 55 },
      { date: '2025-12', total_users: 2450, active_users: 1900, churned_users: 70 },
      { date: '2026-01', total_users: 2820, active_users: 2200, churned_users: 110 },
      { date: '2026-02', total_users: 3290, active_users: 2600, churned_users: 130 },
      { date: '2026-03', total_users: 3750, active_users: 3010, churned_users: 120 },
    ],
  },
  {
    id: 'col-tasks',
    name: 'Tasks',
    fields: [
      { id: 'f1', name: 'title', type: 'text' },
      { id: 'f2', name: 'status', type: 'select', options: ['Backlog', 'In Progress', 'Review', 'Done'] },
      { id: 'f3', name: 'priority', type: 'select', options: ['Low', 'Medium', 'High', 'Critical'] },
      { id: 'f4', name: 'assignee', type: 'text' },
      { id: 'f5', name: 'due_date', type: 'date' },
    ],
    rows: [
      { title: 'Redesign onboarding flow', status: 'In Progress', priority: 'High', assignee: 'Alice Chen', due_date: '2026-04-01' },
      { title: 'Fix payment gateway bug', status: 'Review', priority: 'Critical', assignee: 'Bob Smith', due_date: '2026-03-28' },
      { title: 'Add CSV export feature', status: 'Backlog', priority: 'Medium', assignee: 'Carol Wu', due_date: '2026-04-15' },
      { title: 'Write API documentation', status: 'In Progress', priority: 'Medium', assignee: 'David Park', due_date: '2026-04-05' },
      { title: 'Optimize database queries', status: 'Done', priority: 'High', assignee: 'Alice Chen', due_date: '2026-03-20' },
      { title: 'Implement SSO login', status: 'Backlog', priority: 'High', assignee: 'Bob Smith', due_date: '2026-04-20' },
      { title: 'User permission audit', status: 'Done', priority: 'Medium', assignee: 'Carol Wu', due_date: '2026-03-18' },
      { title: 'Dashboard performance', status: 'In Progress', priority: 'High', assignee: 'David Park', due_date: '2026-04-08' },
    ],
  },
  {
    id: 'col-channels',
    name: 'Acquisition Channels',
    fields: [
      { id: 'f1', name: 'channel', type: 'text' },
      { id: 'f2', name: 'users', type: 'number' },
      { id: 'f3', name: 'revenue', type: 'number' },
    ],
    rows: [
      { channel: 'Organic Search', users: 1420, revenue: 28400 },
      { channel: 'Paid Ads', users: 980, revenue: 19600 },
      { channel: 'Referral', users: 640, revenue: 12800 },
      { channel: 'Social', users: 420, revenue: 8400 },
      { channel: 'Email', users: 290, revenue: 5800 },
    ],
  },
];

export const MOCK_VIEWS = [
  { id: 'view-mrr-line', collectionId: 'col-mrr', name: 'MRR Over Time', type: 'chart.line', xKey: 'date', yKey: 'mrr' },
  { id: 'view-users-area', collectionId: 'col-users', name: 'User Growth Area', type: 'chart.area', xKey: 'date', yKey: 'total_users' },
  { id: 'view-channels-pie', collectionId: 'col-channels', name: 'Channels Distribution', type: 'chart.pie', nameKey: 'channel', valueKey: 'users' },
  { id: 'view-tasks-table', collectionId: 'col-tasks', name: 'All Tasks', type: 'table' },
  { id: 'view-tasks-kanban', collectionId: 'col-tasks', name: 'Tasks Kanban', type: 'kanban', groupField: 'status' },
  { id: 'view-mrr-bar', collectionId: 'col-mrr', name: 'Monthly Revenue Bar', type: 'chart.bar', xKey: 'date', yKey: 'new_mrr' },
];

// Pre-built pages with their component records
export const MOCK_PAGES = [
  {
    id: 'page-saas-overview',
    name: 'SaaS Overview',
    description: 'High-level product metrics dashboard',
    shellId: 'shell-kpi-grid',
    icon: '📊',
    tags: ['analytics', 'saas'],
    componentRecords: [
      {
        id: 'cr-1', typeId: 'widget.metric.kpi', slotId: 'kpi-1',
        props: { title: 'Monthly Revenue', value: '$74,800', trend: '+6.7%', trendDirection: 'up', prefix: '' },
        dataBinding: null,
      },
      {
        id: 'cr-2', typeId: 'widget.metric.kpi', slotId: 'kpi-2',
        props: { title: 'Active Users', value: '3,010', trend: '+15.8%', trendDirection: 'up' },
        dataBinding: null,
      },
      {
        id: 'cr-3', typeId: 'widget.metric.kpi', slotId: 'kpi-3',
        props: { title: 'Churn Rate', value: '3.2%', trend: '-0.4%', trendDirection: 'down' },
        dataBinding: null,
      },
      {
        id: 'cr-4', typeId: 'widget.metric.kpi', slotId: 'kpi-4',
        props: { title: 'NPS Score', value: '72', trend: '+5', trendDirection: 'up' },
        dataBinding: null,
      },
      {
        id: 'cr-5', typeId: 'widget.chart.line', slotId: 'chart-main',
        props: { title: 'MRR Growth' },
        dataBinding: { viewId: 'view-mrr-line', collectionId: 'col-mrr' },
      },
      {
        id: 'cr-6', typeId: 'widget.chart.pie', slotId: 'chart-side',
        props: { title: 'Acquisition Channels' },
        dataBinding: { viewId: 'view-channels-pie', collectionId: 'col-channels' },
      },
      {
        id: 'cr-7', typeId: 'widget.table.data', slotId: 'table',
        props: { title: 'Task Overview' },
        dataBinding: { viewId: 'view-tasks-table', collectionId: 'col-tasks' },
      },
    ],
  },
  {
    id: 'page-project-board',
    name: 'Project Board',
    description: 'Task management and project tracking',
    shellId: 'shell-project-board',
    icon: '🗂️',
    tags: ['projects', 'tasks'],
    componentRecords: [
      {
        id: 'cr-pb-1', typeId: 'content.heading', slotId: 'header',
        props: { text: 'Project Alpha', subtitle: 'Q1 2026 Sprint', level: 'h1' },
        dataBinding: null,
      },
      {
        id: 'cr-pb-2', typeId: 'widget.metric.kpi', slotId: 'stats-1',
        props: { title: 'Total Tasks', value: '24', trend: '+3', trendDirection: 'up' },
        dataBinding: null,
      },
      {
        id: 'cr-pb-3', typeId: 'widget.metric.kpi', slotId: 'stats-2',
        props: { title: 'In Progress', value: '8', trend: '+2', trendDirection: 'up' },
        dataBinding: null,
      },
      {
        id: 'cr-pb-4', typeId: 'widget.metric.kpi', slotId: 'stats-3',
        props: { title: 'Completed', value: '12', trend: '+5', trendDirection: 'up' },
        dataBinding: null,
      },
      {
        id: 'cr-pb-5', typeId: 'widget.metric.kpi', slotId: 'stats-4',
        props: { title: 'Overdue', value: '4', trend: '-1', trendDirection: 'down' },
        dataBinding: null,
      },
      {
        id: 'cr-pb-6', typeId: 'widget.kanban', slotId: 'kanban',
        props: { title: 'Sprint Board', groupField: 'status' },
        dataBinding: { viewId: 'view-tasks-kanban', collectionId: 'col-tasks' },
      },
    ],
  },
  {
    id: 'page-user-growth',
    name: 'User Analytics',
    description: 'User acquisition and retention metrics',
    shellId: 'shell-header-3col',
    icon: '👥',
    tags: ['analytics', 'users'],
    componentRecords: [
      {
        id: 'cr-ug-1', typeId: 'content.heading', slotId: 'header',
        props: { text: 'User Analytics', subtitle: 'Growth & retention insights', level: 'h1' },
        dataBinding: null,
      },
      {
        id: 'cr-ug-2', typeId: 'widget.chart.area', slotId: 'col-1',
        props: { title: 'Total Users' },
        dataBinding: { viewId: 'view-users-area', collectionId: 'col-users' },
      },
      {
        id: 'cr-ug-3', typeId: 'widget.chart.bar', slotId: 'col-2',
        props: { title: 'New MRR by Month' },
        dataBinding: { viewId: 'view-mrr-bar', collectionId: 'col-mrr' },
      },
      {
        id: 'cr-ug-4', typeId: 'widget.chart.pie', slotId: 'col-3',
        props: { title: 'Channel Mix' },
        dataBinding: { viewId: 'view-channels-pie', collectionId: 'col-channels' },
      },
    ],
  },
];

// Simple in-memory store with subscription support
let _pages = [...MOCK_PAGES];
let _subscribers = [];

export const store = {
  getPages: () => _pages,
  getPage: (id) => _pages.find(p => p.id === id),
  savePage: (page) => {
    const idx = _pages.findIndex(p => p.id === page.id);
    if (idx >= 0) {
      _pages[idx] = page;
    } else {
      _pages.push(page);
    }
    _subscribers.forEach(cb => cb());
  },
  deletePage: (id) => {
    _pages = _pages.filter(p => p.id !== id);
    _subscribers.forEach(cb => cb());
  },
  subscribe: (cb) => {
    _subscribers.push(cb);
    return () => { _subscribers = _subscribers.filter(s => s !== cb); };
  },
  getCollectionData: (collectionId) => {
    const col = MOCK_COLLECTIONS.find(c => c.id === collectionId);
    return col ? col.rows : [];
  },
  getView: (viewId) => MOCK_VIEWS.find(v => v.id === viewId),
  getShell: (shellId) => MOCK_SHELLS.find(s => s.id === shellId),
};